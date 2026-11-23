import { Injectable, Logger } from '@nestjs/common';
import { Hocuspocus, Document } from '@hocuspocus/server';
import { TiptapTransformer } from '@hocuspocus/transformer';
import type { JSONContent } from '@tiptap/core';
import {
  prosemirrorNodeToYElement,
  tiptapExtensions,
} from './collaboration.util';
import { setYjsMark, updateYjsMarkAttribute, YjsSelection } from './yjs.util';
import * as Y from 'yjs';
import { User } from '@docmost/db/types/entity.types';
import { applyBlockSplices, planBlockEdits } from './block-edit/block-edits';
import { editableDocument } from './block-edit/block-refs';
import {
  BlockEdit,
  BlockEditPlan,
  BlockEditResult,
} from './block-edit/block-edits.types';

export type CollabEventHandlers = ReturnType<
  CollaborationHandler['getHandlers']
>;

@Injectable()
export class CollaborationHandler {
  private readonly logger = new Logger(CollaborationHandler.name);

  constructor() {}

  getHandlers(hocuspocus: Hocuspocus) {
    return {
      getConnectedUserIds: async (documentName: string) => {
        const document = hocuspocus.documents.get(documentName);
        if (!document) return [];

        const userIds = new Set<string>();
        for (const state of document.awareness.getStates().values()) {
          const userId = state?.user?.id;
          if (typeof userId === 'string') userIds.add(userId);
        }
        return [...userIds];
      },
      flushDocument: async (documentName: string, _payload: object = {}) => {
        await this.flushPendingStore(hocuspocus, documentName);
      },
      alterState: async (documentName: string, payload: { pageId: string }) => {
        // dummy
        // this.logger.log('Processing', documentName, payload);
        // await this.withYdocConnection(hocuspocus, documentName, {}, (doc) => {
        //   const fragment = doc.getXmlFragment('default');
        //});
      },
      setCommentMark: async (
        documentName: string,
        payload: {
          yjsSelection: YjsSelection;
          commentId: string;
          resolved: boolean;
          user: User;
        },
      ) => {
        const { yjsSelection, commentId, resolved, user } = payload;
        await this.withYdocConnection(
          hocuspocus,
          documentName,
          { user },
          (doc) => {
            const fragment = doc.getXmlFragment('default');
            setYjsMark(doc, fragment, yjsSelection, 'comment', {
              commentId,
              resolved,
            });
          },
        );
      },
      resolveCommentMark: async (
        documentName: string,
        payload: {
          commentId: string;
          resolved: boolean;
          user: User;
        },
      ) => {
        const { commentId, resolved, user } = payload;
        await this.withYdocConnection(
          hocuspocus,
          documentName,
          { user },
          (doc) => {
            const fragment = doc.getXmlFragment('default');
            updateYjsMarkAttribute(
              fragment,
              'comment',
              { name: 'commentId', value: commentId },
              { resolved },
            );
          },
        );
      },
      updatePageContent: async (
        documentName: string,
        payload: {
          prosemirrorJson: any;
          operation: string;
          user: User;
        },
      ) => {
        const { prosemirrorJson, operation, user } = payload;
        this.logger.debug('Updating page content via yjs', documentName);
        await this.withYdocConnection(
          hocuspocus,
          documentName,
          { user },
          (doc) => {
            const fragment = doc.getXmlFragment('default');

            if (operation === 'replace') {
              if (fragment.length > 0) {
                fragment.delete(0, fragment.length);
              }

              const newDoc = TiptapTransformer.toYdoc(
                prosemirrorJson,
                'default',
                tiptapExtensions,
              );
              Y.applyUpdate(doc, Y.encodeStateAsUpdate(newDoc));
            } else {
              const newContent = prosemirrorJson.content || [];
              const yElements = newContent.map(prosemirrorNodeToYElement);
              const position = operation === 'prepend' ? 0 : fragment.length;
              fragment.insert(position, yElements);
            }
          },
        );
      },
      getPageContent: async (
        documentName: string,
      ): Promise<JSONContent | null> => {
        if (!hocuspocus.documents.has(documentName)) return null;
        return TiptapTransformer.fromYdoc(
          hocuspocus.documents.get(documentName),
          'default',
        );
      },
      applyBlockEdits: async (
        documentName: string,
        payload: { edits: BlockEdit[]; user: User; expectedRevision?: string },
      ): Promise<BlockEditResult> => {
        const { edits, user, expectedRevision } = payload;
        if (!expectedRevision) {
          return {
            ok: false,
            error: 'Read the page to get its revision before editing it.',
          };
        }
        let result: BlockEditResult;
        await this.withYdocConnection(
          hocuspocus,
          documentName,
          { user },
          (doc) => {
            let plan: BlockEditPlan;
            try {
              const content = TiptapTransformer.fromYdoc(doc, 'default');
              plan = planBlockEdits(
                editableDocument(content),
                edits,
                expectedRevision,
              );
            } catch (error) {
              const message =
                error instanceof Error ? error.message : String(error);
              this.logger.warn(`Block edits on ${documentName}: ${message}`);
              result = {
                ok: false,
                error: `The page could not be edited: ${message}`,
              };
              return;
            }
            if (!plan.ok) {
              result = plan;
              return;
            }
            const fragment = doc.getXmlFragment('default');
            result = applyBlockSplices(fragment, plan.splices)
              ? {
                  ok: true,
                  insertedRefs: plan.insertedRefs,
                  ...(plan.updatedCells && { updatedCells: plan.updatedCells }),
                }
              : {
                  ok: false,
                  error:
                    'This part of the page contains content that cannot be edited safely. Read the page again.',
                };
          },
        );
        return result;
      },
    };
  }

  async withYdocConnection(
    hocuspocus: Hocuspocus,
    documentName: string,
    context: any = {},
    fn: (doc: Document) => void,
  ): Promise<void> {
    // store pending edits first so they are not saved under this connection's user
    await this.flushPendingStore(hocuspocus, documentName);
    const connection = await hocuspocus.openDirectConnection(
      documentName,
      context,
    );
    try {
      await connection.transact(fn);
    } finally {
      await connection.disconnect();
    }
  }

  private async flushPendingStore(
    hocuspocus: Hocuspocus,
    documentName: string,
  ): Promise<void> {
    const document = hocuspocus.documents.get(documentName);
    if (!document || document.isLoading) return;
    await hocuspocus.debouncer.executeNow(`onStoreDocument-${documentName}`);
  }
}
