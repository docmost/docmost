import { HealthIndicatorResult, HealthIndicatorService } from '@nestjs/terminus';
import { KyselyDB } from "../../database/types/kysely.types";
export declare class PostgresHealthIndicator {
    private readonly healthIndicatorService;
    private readonly db;
    private readonly logger;
    constructor(healthIndicatorService: HealthIndicatorService, db: KyselyDB);
    pingCheck(key: string): Promise<HealthIndicatorResult>;
}
