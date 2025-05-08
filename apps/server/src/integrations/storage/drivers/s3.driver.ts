import { S3StorageConfig, StorageDriver, StorageOption } from '../interfaces';
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { streamToBuffer } from '../storage.utils';
import { Readable } from 'stream';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getMimeType } from '../../../common/helpers';

export class S3Driver implements StorageDriver {
  private readonly s3Client: S3Client;
  private readonly config: S3StorageConfig;

  constructor(config: S3StorageConfig) {
    this.config = config;
    this.s3Client = new S3Client(config as any);
  }

  async upload(filePath: string, file: Buffer): Promise<void> {
    try {
      const contentType = getMimeType(filePath);

      const command = new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: filePath,
        Body: file,
        ContentType: contentType,
        // ACL: "public-read",
      });

      await this.s3Client.send(command);
    } catch (err) {
      throw new Error(`Failed to upload file: ${(err as Error).message}`);
    }
  }

  async copy(fromFilePath: string, toFilePath: string): Promise<void> {
    try {
      if (await this.exists(fromFilePath)) {
        await this.s3Client.send(
          new CopyObjectCommand({
            Bucket: this.config.bucket,
            CopySource: `${this.config.bucket}/${fromFilePath}`,
            Key: toFilePath,
          }),
        );
      }
    } catch (err) {
      throw new Error(`Failed to copy file: ${(err as Error).message}`);
    }
  }

  async read(filePath: string): Promise<Buffer> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: filePath,
      });

      const response = await this.s3Client.send(command);

      return streamToBuffer(response.Body as Readable);
    } catch (err) {
      throw new Error(`Failed to read file from S3: ${(err as Error).message}`);
    }
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.config.bucket,
        Key: filePath,
      });

      await this.s3Client.send(command);
      return true;
    } catch (err) {
      if (err instanceof NoSuchKey) {
        return false;
      }
      throw err;
    }
  }
  getUrl(filePath: string): string {
    return `${this.config.baseUrl ?? this.config.endpoint}/${this.config.bucket}/${filePath}`;
  }

  async getSignedUrl(filePath: string, expiresIn: number): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.config.bucket,
      Key: filePath,
    });
    return await getSignedUrl(this.s3Client, command, { expiresIn });
  }

  async delete(filePath: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.config.bucket,
        Key: filePath,
      });

      await this.s3Client.send(command);
    } catch (err) {
      throw new Error(
        `Error deleting file ${filePath} from S3. ${(err as Error).message}`,
      );
    }
  }

  getDriver(): S3Client {
    return this.s3Client;
  }

  getDriverName(): string {
    return StorageOption.S3;
  }

  getConfig(): Record<string, any> {
    return this.config;
  }
}
