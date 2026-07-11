import { SchedulerRegistry } from '@nestjs/schedule';
import { EnvironmentService } from '../environment/environment.service';
import { KyselyDB } from "../../database/types/kysely.types";
import { WorkspaceRepo } from "../../database/repos/workspace/workspace.repo";
export declare class TelemetryService {
    private readonly environmentService;
    private readonly db;
    private readonly workspaceRepo;
    private schedulerRegistry;
    private readonly ENDPOINT_URL;
    constructor(environmentService: EnvironmentService, db: KyselyDB, workspaceRepo: WorkspaceRepo, schedulerRegistry: SchedulerRegistry);
    sendTelemetry(): Promise<void>;
}
