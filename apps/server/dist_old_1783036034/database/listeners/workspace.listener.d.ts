import { Queue } from 'bullmq';
import { EnvironmentService } from '../../integrations/environment/environment.service';
export declare class WorkspaceEvent {
    workspaceId: string;
}
export declare class WorkspaceListener {
    private readonly environmentService;
    private searchQueue;
    private aiQueue;
    private readonly logger;
    constructor(environmentService: EnvironmentService, searchQueue: Queue, aiQueue: Queue);
    handlePageDeleted(event: WorkspaceEvent): Promise<void>;
    isTypesense(): boolean;
}
