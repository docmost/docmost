import { Readable } from 'stream';
import { AzureStorageConfig, StorageDriver } from '../interfaces';
import { BlobServiceClient } from '@azure/storage-blob';
export declare class AzureDriver implements StorageDriver {
    private readonly config;
    private readonly blobServiceClient;
    private readonly containerClient;
    private readonly sharedKeyCredential;
    private readonly accountUrl;
    constructor(config: AzureStorageConfig);
    private blockBlob;
    upload(filePath: string, file: Buffer | Readable): Promise<void>;
    uploadStream(filePath: string, file: Readable, options?: {
        recreateClient?: boolean;
    }): Promise<void>;
    copy(fromFilePath: string, toFilePath: string): Promise<void>;
    read(filePath: string): Promise<Buffer>;
    readStream(filePath: string): Promise<Readable>;
    readRangeStream(filePath: string, range: {
        start: number;
        end: number;
    }): Promise<Readable>;
    exists(filePath: string): Promise<boolean>;
    getUrl(filePath: string): string;
    getSignedUrl(filePath: string, expiresIn: number): Promise<string>;
    delete(filePath: string): Promise<void>;
    getDriver(): BlobServiceClient;
    getDriverName(): string;
    getConfig(): Record<string, any>;
    private createBlobServiceClient;
}
