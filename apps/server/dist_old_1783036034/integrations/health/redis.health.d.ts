import { HealthIndicatorResult, HealthIndicatorService } from '@nestjs/terminus';
import { EnvironmentService } from '../environment/environment.service';
export declare class RedisHealthIndicator {
    private readonly healthIndicatorService;
    private environmentService;
    private readonly logger;
    constructor(healthIndicatorService: HealthIndicatorService, environmentService: EnvironmentService);
    pingCheck(key: string): Promise<HealthIndicatorResult>;
}
