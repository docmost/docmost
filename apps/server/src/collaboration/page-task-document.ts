import * as Y from 'yjs';
import { randomUUID } from 'node:crypto';
import { isTransactionOrigin } from '@hocuspocus/server';
import { taskBlockId } from '../core/task/task-content';

// Capture the authenticated author at insertion time. A debounced page save
// can contain task items created by several different connections.
export class PageTaskDocument {
  private readonly elements = new Map<string, Y.XmlElement>();
  private readonly insertedBy = new WeakMap<Y.XmlElement, string>();
  private readonly checkedBy = new WeakMap<Y.XmlElement, string>();
  private readonly creators = new Map<string, string>();

  constructor(private readonly doc: Y.Doc) {
    this.prepareItems(true);
    doc.getXmlFragment('default').observeDeep((events, transaction) => {
      const origin = transaction.origin;
      if (!isTransactionOrigin(origin) || origin.source === 'redis') return;
      const context =
        origin.source === 'connection'
          ? origin.connection.context
          : origin.context;
      const userId = context?.user?.id;
      if (!userId) return;
      for (const event of events) {
        if (!(event instanceof Y.YXmlEvent)) continue;
        if (
          event.target instanceof Y.XmlElement &&
          event.target.nodeName === 'taskItem' &&
          event.attributesChanged.has('checked')
        ) {
          this.checkedBy.set(event.target, userId);
        }
        for (const change of event.changes.delta) {
          if (!Array.isArray(change.insert)) continue;
          for (const node of change.insert) this.trackInsertion(node, userId);
        }
      }
    });
  }

  private trackInsertion(node: unknown, userId: string) {
    if (!(node instanceof Y.XmlElement)) return;
    if (node.nodeName === 'taskItem') {
      this.insertedBy.set(node, userId);
      this.checkedBy.set(node, userId);
      const id = node.getAttribute('id');
      if (id && !this.elements.has(id) && !this.creators.has(id))
        this.creators.set(id, userId);
    }
    for (const child of node.toArray()) this.trackInsertion(child, userId);
  }

  checkActors(): Map<string, string> {
    const result = new Map<string, string>();
    for (const [id, element] of this.elements) {
      const actor = this.checkedBy.get(element);
      if (actor) result.set(id, actor);
    }
    return result;
  }

  prepareItems(loading = false): Map<string, string> {
    const seen = new Set<string>();
    const path: number[] = [];
    const visit = (parent: Y.XmlFragment) => {
      parent.toArray().forEach((node, index) => {
        if (!(node instanceof Y.XmlElement)) return;
        path.push(index);
        if (node.nodeName === 'taskItem') {
          const previous = node.getAttribute('id');
          const owner = this.elements.get(previous);
          // A paste or prepend can place a duplicate before the original item.
          // A surviving element keeps its ID regardless of document order.
          const candidate =
            owner && owner !== node && !owner._item?.deleted ? null : previous;
          const id = taskBlockId(
            candidate,
            path,
            seen,
            loading ? undefined : randomUUID,
          );
          this.elements.set(id, node);
          if (previous !== id) node.setAttribute('id', id);
          const author = this.insertedBy.get(node);
          if (author && !this.creators.has(id)) this.creators.set(id, author);
        }
        visit(node);
        path.pop();
      });
    };
    this.doc.transact(() => visit(this.doc.getXmlFragment('default')), {
      source: 'local',
      skipStoreHooks: true,
    });
    for (const id of this.elements.keys()) {
      if (!seen.has(id)) {
        this.elements.delete(id);
        this.creators.delete(id);
      }
    }
    return new Map(this.creators);
  }
}

type TaskElement = Y.XmlElement<{ id: string; checked: boolean }>;

export function findTaskItem(
  doc: Y.Doc,
  blockId: string,
): TaskElement | undefined {
  for (const node of doc
    .getXmlFragment('default')
    .createTreeWalker(
      (node) =>
        node instanceof Y.XmlElement &&
        node.nodeName === 'taskItem' &&
        node.getAttribute('id') === blockId,
    )) {
    return node as TaskElement;
  }
}
