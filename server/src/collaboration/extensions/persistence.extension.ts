import {
  Extension,
  onLoadDocumentPayload,
  onStoreDocumentPayload,
} from '@hocuspocus/server';
import * as Y from 'yjs';
import { PageService } from '../../core/page/services/page.service';
import { Injectable } from '@nestjs/common';
import { TiptapTransformer } from '@hocuspocus/transformer';

@Injectable()
export class PersistenceExtension implements Extension {
  constructor(private readonly pageService: PageService) {}

  async onLoadDocument(data: onLoadDocumentPayload) {
    const { documentName, document } = data;

    if (!document.isEmpty('default')) {
      return;
    }

    const page = await this.pageService.findById(documentName);

    if (!page) {
      console.log('page does not exist.');
      //TODO: terminate connection if the page does not exist?
      return;
    }

    if (page.ydoc) {
      console.log('ydoc loaded from db');

      const doc = new Y.Doc();
      const dbState = new Uint8Array(page.ydoc);

      Y.applyUpdate(doc, dbState);
      return doc;
    }

    // if no ydoc state in db convert json in page.content to Ydoc.
    if (page.content) {
      console.log('converting json to ydoc');

      const ydoc = TiptapTransformer.toYdoc(page.content, 'default');
      Y.encodeStateAsUpdate(ydoc);
      return ydoc;
    }

    console.log('creating fresh ydoc');
    return new Y.Doc();
  }

  async onStoreDocument(data: onStoreDocumentPayload) {
    const { documentName, document, context } = data;

    const pageId = documentName;

    const tiptapJson = TiptapTransformer.fromYdoc(document, 'default');
    const ydocState = Buffer.from(Y.encodeStateAsUpdate(document));

    try {
      await this.pageService.updateState(pageId, tiptapJson, ydocState);
    } catch (err) {
      console.error(`Failed to update page ${documentName}`);
    }
  }
}
