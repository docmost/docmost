import { WebSocketServer } from 'ws';
export declare class CollabWsAdapter {
    private readonly wss;
    constructor();
    handleUpgrade(path: string, httpServer: any): WebSocketServer;
    close(): void;
    destroy(): void;
}
