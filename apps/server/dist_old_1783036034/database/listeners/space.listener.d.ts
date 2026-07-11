import { Queue } from 'bullmq';
import { EnvironmentService } from '../../integrations/environment/environment.service';
export declare class SpaceEvent {
    spaceId: string;
}
export declare class SpaceListener {
    private readonly environmentService;
    private searchQueue;
    private aiQueue;
    private readonly logger;
    constructor(environmentService: EnvironmentService, searchQueue: Queue, aiQueue: Queue);
    handleSpaceDeleted(event: SpaceEvent): Promise<void>;
    isTypesense(): boolean;
}
