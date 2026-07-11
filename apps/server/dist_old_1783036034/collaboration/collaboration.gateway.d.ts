import { IncomingMessage } from 'http';
import WebSocket from 'ws';
import { AuthenticationExtension } from './extensions/authentication.extension';
import { PersistenceExtension } from './extensions/persistence.extension';
import { EnvironmentService } from '../integrations/environment/environment.service';
import { LoggerExtension } from './extensions/logger.extension';
import { CollabWsAdapter } from './adapter/collab-ws.adapter';
import { CollaborationHandler, CollabEventHandlers } from './collaboration.handler';
export declare class CollaborationGateway {
    private authenticationExtension;
    private persistenceExtension;
    private loggerExtension;
    private environmentService;
    private collabEventsService;
    private readonly hocuspocus;
    private redisConfig;
    private readonly redisSync;
    private readonly withRedis;
    constructor(authenticationExtension: AuthenticationExtension, persistenceExtension: PersistenceExtension, loggerExtension: LoggerExtension, environmentService: EnvironmentService, collabEventsService: CollaborationHandler);
    private serializeRequest;
    handleConnection(client: WebSocket, request: IncomingMessage): any;
    getConnectionCount(): number;
    getDocumentCount(): number;
    handleYjsEvent<TName extends keyof CollabEventHandlers>(eventName: TName, documentName: string, payload: Parameters<CollabEventHandlers[TName]>[1]): Promise<ReturnType<{
        alterState: (documentName: string, payload: {
            pageId: string;
        }) => Promise<void>;
        setCommentMark: (documentName: string, payload: {
            yjsSelection: import("./yjs.util").YjsSelection;
            commentId: string;
            resolved: boolean;
            user: import("../database/types/entity.types").User;
        }) => Promise<void>;
        resolveCommentMark: (documentName: string, payload: {
            commentId: string;
            resolved: boolean;
            user: import("../database/types/entity.types").User;
        }) => Promise<void>;
        updatePageContent: (documentName: string, payload: {
            prosemirrorJson: any;
            operation: string;
            user: import("../database/types/entity.types").User;
        }) => Promise<void>;
    }[TName]>>;
    openDirectConnection(documentName: string, context?: any): Promise<import("@hocuspocus/server/dist/packages/server/src/DirectConnection").DirectConnection>;
    lockDocument(documentName: string): Promise<() => Promise<number>>;
    releaseLock(documentName: string): Promise<number>;
    destroy(collabWsAdapter: CollabWsAdapter): Promise<void>;
}
