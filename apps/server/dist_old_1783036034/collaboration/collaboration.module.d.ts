import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { CollaborationGateway } from './collaboration.gateway';
import { HttpAdapterHost } from '@nestjs/core';
export declare class CollaborationModule implements OnModuleInit, OnModuleDestroy {
    private readonly collaborationGateway;
    private readonly httpAdapterHost;
    private readonly logger;
    private collabWsAdapter;
    private path;
    constructor(collaborationGateway: CollaborationGateway, httpAdapterHost: HttpAdapterHost);
    onModuleInit(): void;
    onModuleDestroy(): Promise<void>;
}
