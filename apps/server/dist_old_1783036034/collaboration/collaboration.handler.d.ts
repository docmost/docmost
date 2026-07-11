import { Hocuspocus, Document } from '@hocuspocus/server';
import { YjsSelection } from './yjs.util';
import { User } from "../database/types/entity.types";
export type CollabEventHandlers = ReturnType<CollaborationHandler['getHandlers']>;
export declare class CollaborationHandler {
    private readonly logger;
    constructor();
    getHandlers(hocuspocus: Hocuspocus): {
        alterState: (documentName: string, payload: {
            pageId: string;
        }) => Promise<void>;
        setCommentMark: (documentName: string, payload: {
            yjsSelection: YjsSelection;
            commentId: string;
            resolved: boolean;
            user: User;
        }) => Promise<void>;
        resolveCommentMark: (documentName: string, payload: {
            commentId: string;
            resolved: boolean;
            user: User;
        }) => Promise<void>;
        updatePageContent: (documentName: string, payload: {
            prosemirrorJson: any;
            operation: string;
            user: User;
        }) => Promise<void>;
    };
    withYdocConnection(hocuspocus: Hocuspocus, documentName: string, context: any, fn: (doc: Document) => void): Promise<void>;
}
