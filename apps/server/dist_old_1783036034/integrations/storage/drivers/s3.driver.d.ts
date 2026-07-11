import { S3StorageConfig, StorageDriver } from '../interfaces';
import { S3Client } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
export declare class S3Driver implements StorageDriver {
    private readonly s3Client;
    private readonly config;
    constructor(config: S3StorageConfig);
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
    getDriver(): S3Client;
    getDriverName(): string;
    getConfig(): Record<string, any>;
}
