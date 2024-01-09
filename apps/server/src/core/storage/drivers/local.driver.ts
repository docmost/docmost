import {
  StorageDriver,
  LocalStorageConfig,
  StorageOption,
} from '../interfaces';
import { join } from 'path';
import * as fs from 'fs-extra';

export class LocalDriver implements StorageDriver {
  private readonly config: LocalStorageConfig;

  constructor(config: LocalStorageConfig) {
    this.config = config;
  }

  private _fullPath(filePath: string): string {
    return join(this.config.storagePath, filePath);
  }

  async upload(filePath: string, file: Buffer): Promise<void> {
    try {
      await fs.outputFile(this._fullPath(filePath), file);
    } catch (error) {
      throw new Error(`Failed to upload file: ${error.message}`);
    }
  }

  async read(filePath: string): Promise<Buffer> {
    try {
      return await fs.readFile(this._fullPath(filePath));
    } catch (error) {
      throw new Error(`Failed to read file: ${error.message}`);
    }
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      return await fs.pathExists(this._fullPath(filePath));
    } catch (error) {
      throw new Error(`Failed to check file existence: ${error.message}`);
    }
  }

  async getSignedUrl(filePath: string, expireIn: number): Promise<string> {
    throw new Error('Signed URLs are not supported for local storage.');
  }

  getUrl(filePath: string): string {
    return this._fullPath(filePath);
  }

  async delete(filePath: string): Promise<void> {
    try {
      await fs.remove(this._fullPath(filePath));
    } catch (error) {
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  getDriver(): typeof fs {
    return fs;
  }

  getDriverName(): string {
    return StorageOption.LOCAL;
  }

  getConfig(): Record<string, any> {
    return this.config;
  }
}
