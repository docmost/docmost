import { PageRepo } from "../../../database/repos/page/page.repo";
import { MultipartFile } from '@fastify/multipart';
import { KyselyDB } from "../../../database/types/kysely.types";
import { StorageService } from '../../storage/storage.service';
import { Queue } from 'bullmq';
import { ModuleRef } from '@nestjs/core';
export declare class ImportService {
    private readonly pageRepo;
    private readonly storageService;
    private readonly db;
    private readonly fileTaskQueue;
    private moduleRef;
    private readonly logger;
    constructor(pageRepo: PageRepo, storageService: StorageService, db: KyselyDB, fileTaskQueue: Queue, moduleRef: ModuleRef);
    importPage(filePromise: Promise<MultipartFile>, userId: string, spaceId: string, workspaceId: string): Promise<any>;
    processMarkdown(markdownInput: string): Promise<any>;
    processHTML(htmlInput: string): Promise<any>;
    processDocx(fileBuffer: Buffer, workspaceId: string, spaceId: string, pageId: string, userId: string): Promise<any>;
    processPdf(fileBuffer: Buffer, workspaceId: string, spaceId: string, pageId: string, userId: string): Promise<any>;
    createYdoc(prosemirrorJson: any): Promise<Buffer | null>;
    extractTitleAndRemoveHeading(prosemirrorState: any): {
        title: string;
        prosemirrorJson: any;
    };
    getNewPagePosition(spaceId: string, parentPageId?: string): Promise<string>;
    importZip(filePromise: Promise<MultipartFile>, source: string, userId: string, spaceId: string, workspaceId: string): Promise<{
        type: string;
        id: string;
        workspaceId: string;
        creatorId: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date;
        metadata: import("../../../database/types/db").JsonValue;
        status: string;
        spaceId: string;
        pageId: string;
        fileExt: string;
        fileName: string;
        filePath: string;
        fileSize: string;
        errorMessage: string;
        source: string;
    }>;
}
