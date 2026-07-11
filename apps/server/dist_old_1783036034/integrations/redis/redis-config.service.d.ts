import { RedisModuleOptions, RedisOptionsFactory } from '@nestjs-labs/nestjs-ioredis';
import { EnvironmentService } from '../environment/environment.service';
export declare class RedisConfigService implements RedisOptionsFactory {
    private readonly environmentService;
    constructor(environmentService: EnvironmentService);
    createRedisOptions(): RedisModuleOptions;
}
