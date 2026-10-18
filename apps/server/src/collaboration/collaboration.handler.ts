import { Injectable, Logger } from '@nestjs/common';
import { Hocuspocus, Document } from '@hocuspocus/server';
import { ResetConnection } from '@hocuspocus/common';
import { TiptapTransformer } from '@hocuspocus/transformer';
import {
  getPageId,
  prosemirrorNodeToYElement,
  tiptapExtensions,
} from './collaboration.util';
import { setYjsMark, updateYjsMarkAttribute, YjsSelection } from './yjs.util';
import * as Y from 'yjs';
import { User } from '@docmost/db/types/entity.types';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { PageApprovalService } from '../core/page/approval/page-approval.service';

export type CollabEventHandlers = ReturnType<
  CollaborationHandler['getHandlers']
>;

@Injectable()
export class CollaborationHandler {
  private readonly logger = new Logger(CollaborationHandler.name);

  constructor(
    private readonly pageRepo: PageRepo,
    private readonly pageApprovalService: PageApprovalService,
  ) {}

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
          // set only by PageApprovalPublishService when it resets a locked draft
          force?: boolean;
        },
      ) => {
        const { prosemirrorJson, operation, user, force } = payload;
        if (!force) {
          await this.assertNotLocked(documentName);
        }
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
      // Must not run inside a page-locked transaction; the disconnect stores the document.
      freezeDraft: async (documentName: string): Promise<any> => {
        const connection = await hocuspocus.openDirectConnection(
          documentName,
          {},
        );
        try {
          // read-only first, so no edit lands between the flip and the read
          const document = hocuspocus.documents.get(documentName);
          for (const client of document?.getConnections() ?? []) {
            client.readOnly = true;
            client.sendStateless(
              JSON.stringify({ type: 'page.permissions', access: 'read' }),
            );
          }

          let json: any;
          await connection.transact((doc) => {
            json = TiptapTransformer.fromYdoc(doc, 'default');
          });
          return json;
        } finally {
          await connection.disconnect();
        }
      },
      resetConnections: async (documentName: string): Promise<void> => {
        const document = hocuspocus.documents.get(documentName);
        if (!document) return;

        for (const connection of document.getConnections()) {
          connection.close(ResetConnection);
        }
      },
    };
  }

  async withYdocConnection(
    hocuspocus: Hocuspocus,
    documentName: string,
    context: any = {},
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

  private async assertNotLocked(documentName: string): Promise<void> {
    const page = await this.pageRepo.findById(getPageId(documentName));
    if (!page) return;

    const state = await this.pageApprovalService.getState(page);
    if (state.locked) {
      throw new Error('Page is locked for approval');
    }
  }
}
