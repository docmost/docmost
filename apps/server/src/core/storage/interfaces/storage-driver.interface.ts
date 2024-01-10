export interface StorageDriver {
  upload(filePath: string, file: Buffer): Promise<void>;

  read(filePath: string): Promise<Buffer>;

  exists(filePath: string): Promise<boolean>;

  getUrl(filePath: string): string;

  getSignedUrl(filePath: string, expireIn: number): Promise<string>;

  delete(filePath: string): Promise<void>;

  getDriver(): any;

  getDriverName(): string;

  getConfig(): Record<string, any>;
}
