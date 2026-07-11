import { OnModuleInit } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { EnvironmentService } from '../environment/environment.service';
export declare class StaticModule implements OnModuleInit {
    private readonly httpAdapterHost;
    private readonly environmentService;
    constructor(httpAdapterHost: HttpAdapterHost, environmentService: EnvironmentService);
    onModuleInit(): Promise<void>;
}
