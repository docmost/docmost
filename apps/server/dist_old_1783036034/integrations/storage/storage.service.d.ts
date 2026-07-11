import { StorageDriver } from './interfaces';
import { Readable } from 'stream';
export declare class StorageService {
    private storageDriver;
    private readonly logger;
    constructor(storageDriver: StorageDriver);
    upload(filePath: string, fileContent: Buffer | Readable): Promise<void>;
    uploadStream(filePath: string, fileContent: Readable, options?: {
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
    getSignedUrl(path: string, expireIn: number): Promise<string>;
    getUrl(filePath: string): string;
    delete(filePath: string): Promise<void>;
    getDriverName(): string;
}
