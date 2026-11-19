import type {
  afterLoadDocumentPayload,
  beforeSyncPayload,
  connectedPayload,
  Connection,
  Document,
  Extension,
  onConnectPayload,
} from '@hocuspocus/server';
import { Forbidden } from '@hocuspocus/common';
import { supportsTemplatePlaceholders } from '@docmost/editor-ext';
import * as Y from 'yjs';

function containsPlaceholder(node: unknown): boolean {
  return (
    node instanceof Y.XmlElement &&
    (node.nodeName === 'templatePlaceholder' ||
      node.toArray().some(containsPlaceholder))
  );
}

const reloadRequired = {
  ...Forbidden,
  reason: 'Reload Docmost to edit this page with template placeholders.',
};

export class EditorSchemaExtension implements Extension {
  private readonly protectedDocs = new WeakSet<Document>();

  async onConnect({ requestParameters }: onConnectPayload) {
    return {
      supportsPlaceholders: supportsTemplatePlaceholders(
        requestParameters.get('editorSchema'),
      ),
    };
  }

  async afterLoadDocument({ document }: afterLoadDocumentPayload) {
    const root = document.getXmlFragment('default');
    if (root.toArray().some(containsPlaceholder)) {
      this.protectedDocs.add(document);
      return;
    }

    // Yjs deep observers run before update broadcasts. Disconnect older peers
    // before their binding sees an unknown node and syncs a deletion.
    const onChange = (events: Y.YEvent<any>[]) => {
      const inserted = events.some(
        (event) =>
          event.target instanceof Y.XmlFragment &&
          event.changes.delta.some(
            (change) =>
              Array.isArray(change.insert) &&
              change.insert.some(containsPlaceholder),
          ),
      );
      if (!inserted) return;
      root.unobserveDeep(onChange);
      this.protectedDocs.add(document);
      for (const connection of document.getConnections())
        this.rejectIfUnsupported(connection);
    };
    root.observeDeep(onChange);
  }

  private rejectIfUnsupported(connection: Connection): boolean {
    if (
      connection.context.supportsPlaceholders ||
      !this.protectedDocs.has(connection.document)
    )
      return false;
    connection.readOnly = true;
    connection.sendStateless(
      JSON.stringify({ type: 'page.permissions', access: 'read' }),
    );
    connection.close(reloadRequired);
    return true;
  }

  async connected({ connection }: connectedPayload) {
    this.rejectIfUnsupported(connection);
  }

  async beforeSync({ connection }: beforeSyncPayload) {
    // Initial sync messages can be queued before the connected hook finishes.
    if (this.rejectIfUnsupported(connection)) throw reloadRequired;
  }
}
