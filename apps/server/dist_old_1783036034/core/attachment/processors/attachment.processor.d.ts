import { OnModuleDestroy } from '@nestjs/common';
import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { AttachmentService } from '../services/attachment.service';
import { ModuleRef } from '@nestjs/core';
export declare class AttachmentProcessor extends WorkerHost implements OnModuleDestroy {
    private readonly attachmentService;
    private moduleRef;
    private readonly logger;
    constructor(attachmentService: AttachmentService, moduleRef: ModuleRef);
    process(job: Job<any, void>): Promise<void>;
    onActive(job: Job): void;
    onError(job: Job): void;
    onCompleted(job: Job): void;
    onModuleDestroy(): Promise<void>;
}
