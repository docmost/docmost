import { OnApplicationBootstrap } from '@nestjs/common';
import { EnvironmentService } from '../integrations/environment/environment.service';
import { KyselyDB } from "./types/kysely.types";
import { MigrationService } from "./services/migration.service";
export declare class DatabaseModule implements OnApplicationBootstrap {
    private readonly db;
    private readonly migrationService;
    private readonly environmentService;
    private readonly logger;
    constructor(db: KyselyDB, migrationService: MigrationService, environmentService: EnvironmentService);
    onApplicationBootstrap(): Promise<void>;
    establishConnection(): Promise<void>;
}
