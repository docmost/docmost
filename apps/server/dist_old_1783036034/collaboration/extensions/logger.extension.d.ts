import { Extension, onDisconnectPayload, onLoadDocumentPayload } from '@hocuspocus/server';
export declare class LoggerExtension implements Extension {
    private readonly logger;
    afterUnloadDocument(data: onLoadDocumentPayload): Promise<void>;
    onDisconnect(data: onDisconnectPayload): Promise<void>;
}
