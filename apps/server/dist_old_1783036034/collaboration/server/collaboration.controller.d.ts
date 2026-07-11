import { CollaborationGateway } from '../collaboration.gateway';
export declare class CollaborationController {
    private readonly collaborationGateway;
    constructor(collaborationGateway: CollaborationGateway);
    getStats(): Promise<{
        connections: number;
        documents: number;
    }>;
}
