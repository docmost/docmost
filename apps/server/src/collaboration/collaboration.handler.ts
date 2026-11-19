import { Injectable, Logger } from '@nestjs/common';
import { Hocuspocus, Document } from '@hocuspocus/server';
import { TiptapTransformer } from '@hocuspocus/transformer';
import {
  prosemirrorNodeToYElement,
  tiptapExtensions,
} from './collaboration.util';
import { setYjsMark, updateYjsMarkAttribute, YjsSelection } from './yjs.util';
import * as Y from 'yjs';
import { findTaskItem } from './page-task-document';
import { yXmlFragmentToProsemirrorJSON } from '@tiptap/y-tiptap';
import { readTaskItem } from '../core/task/task-content';
import { PageTaskRepo } from '@docmost/db/repos/page-task/page-task.repo';
import { User } from '@docmost/db/types/entity.types';

export type CollabEventHandlers = ReturnType<
  CollaborationHandler['getHandlers']
>;

@Injectable()
export class CollaborationHandler {
  private readonly logger = new Logger(CollaborationHandler.name);

  constructor(private readonly pageTasks: PageTaskRepo) {}

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
      setTaskChecked: async (
        documentName: string,
        payload: {
          taskId: string;
          workspaceId: string;
          checked: boolean;
          user: User;
        },
      ): Promise<'updated' | 'missing' | 'read-only'> => {
        const { taskId, workspaceId, user, checked } = payload;
        // Permissions and ownership may change while a request travels to the
        // server holding the document or while pending editor changes flush.
        await this.flushPendingStore(hocuspocus, documentName);
        const task = await this.pageTasks.findPersonal(
          taskId,
          user.id,
          workspaceId,
        );
        if (!task || documentName !== `page.${task.pageId}`) return 'missing';
        const editable = await this.pageTasks.editablePages([task], user.id);
        if (!editable.has(task.pageId)) return 'read-only';

        let found = false;
        await this.transactWithYdoc(
          hocuspocus,
          documentName,
          { user },
          (doc) => {
            const item = findTaskItem(doc, task.blockId);
            if (!item) return;
            if (task.creatorId !== user.id) {
              const current = readTaskItem(
                yXmlFragmentToProsemirrorJSON(item),
                task.blockId,
              );
              if (current.assigneeId !== user.id) return;
            }
            found = true;
            if ((item.getAttribute('checked') === true) !== checked)
              item.setAttribute('checked', checked);
          },
        );
        return found ? 'updated' : 'missing';
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
    return this.transactWithYdoc(hocuspocus, documentName, context, fn);
  }

  private async transactWithYdoc(
    hocuspocus: Hocuspocus,
    documentName: string,
    context: object,
    fn: (doc: Document) => void,
  ): Promise<void> {
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
