import { Queue } from 'bullmq';
import { EnvironmentService } from '../../integrations/environment/environment.service';
export declare class PageEvent {
    pageIds: string[];
    workspaceId: string;
}
export declare class PageListener {
    private readonly environmentService;
    private searchQueue;
    private aiQueue;
    private readonly logger;
    constructor(environmentService: EnvironmentService, searchQueue: Queue, aiQueue: Queue);
    handlePageCreated(event: PageEvent): Promise<void>;
    handlePageUpdated(event: PageEvent): Promise<void>;
    handlePageDeleted(event: PageEvent): Promise<void>;
    handlePageSoftDeleted(event: PageEvent): Promise<void>;
    handlePageRestored(event: PageEvent): Promise<void>;
    isTypesense(): boolean;
}
