import { StorageDriver, LocalStorageConfig } from '../interfaces';
import * as fs from 'fs-extra';
import { Readable } from 'stream';
export declare class LocalDriver implements StorageDriver {
    private readonly config;
    constructor(config: LocalStorageConfig);
    private _fullPath;
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
    getSignedUrl(filePath: string, expireIn: number): Promise<string>;
    getUrl(filePath: string): string;
    delete(filePath: string): Promise<void>;
    getDriver(): typeof fs;
    getDriverName(): string;
    getConfig(): Record<string, any>;
}
