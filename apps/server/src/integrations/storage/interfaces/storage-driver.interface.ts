import { Readable } from 'stream';

export interface StorageDriver {
  upload(filePath: string, file: Buffer | Readable): Promise<void>;

  uploadStream(filePath: string, file: Readable, options?: { recreateClient?: boolean }): Promise<void>;

  copy(fromFilePath: string, toFilePath: string): Promise<void>;

  read(filePath: string): Promise<Buffer>;

  readStream(filePath: string): Promise<Readable>;

  exists(filePath: string): Promise<boolean>;

  getUrl(filePath: string): string;

  getSignedUrl(filePath: string, expireIn: number): Promise<string>;

  delete(filePath: string): Promise<void>;

  getDriver(): any;

  getDriverName(): string;

  getConfig(): Record<string, any>;
}
