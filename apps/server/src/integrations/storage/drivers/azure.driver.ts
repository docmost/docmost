import { Readable } from 'stream';
import {
  AzureStorageConfig,
  StorageDriver,
  StorageOption,
} from '../interfaces';
import {
  BlobSASPermissions,
  BlobServiceClient,
  BlockBlobClient,
  ContainerClient,
  generateBlobSASQueryParameters,
  SASProtocol,
  StorageSharedKeyCredential,
} from '@azure/storage-blob';
import { Logger } from '@nestjs/common';
import { getMimeType } from '../../../common/helpers';

export class AzureDriver implements StorageDriver {
  private readonly config: AzureStorageConfig;
  private readonly blobServiceClient: BlobServiceClient;
  private readonly containerClient: ContainerClient;
  private readonly sharedKeyCredential: StorageSharedKeyCredential;
  private readonly accountUrl: string;

  constructor(config: AzureStorageConfig) {
    this.config = config;

    if (!config.accountName) {
      throw new Error('AzureDriver: accountName is required');
    }
    if (!config.container) {
      throw new Error('AzureDriver: container is required');
    }
    if (!config.accountKey) {
      throw new Error('AzureDriver: accountKey is required');
    }

    this.accountUrl =
      config.endpoint ??
      `https://${config.accountName}.blob.core.windows.net`;

    this.sharedKeyCredential = new StorageSharedKeyCredential(
      config.accountName,
      config.accountKey,
    );

    this.blobServiceClient = this.createBlobServiceClient();
    this.containerClient = this.blobServiceClient.getContainerClient(
      config.container,
    );
  }

  private blockBlob(filePath: string): BlockBlobClient {
    return this.containerClient.getBlockBlobClient(filePath);
  }

  async upload(filePath: string, file: Buffer | Readable): Promise<void> {
    const stream: Readable = Buffer.isBuffer(file) ? Readable.from(file) : file;
    await this.uploadStream(filePath, stream);
  }

  async uploadStream(
    filePath: string,
    file: Readable,
    options?: { recreateClient?: boolean },
  ): Promise<void> {
    const clientToUse = options?.recreateClient
      ? this.createBlobServiceClient()
          .getContainerClient(this.config.container)
          .getBlockBlobClient(filePath)
      : this.blockBlob(filePath);

    try {
      const contentType = getMimeType(filePath);
      await clientToUse.uploadStream(file, undefined, undefined, {
        blobHTTPHeaders: { blobContentType: contentType },
      });
    } catch (err) {
      Logger.error(err);
      throw new Error(`Failed to upload file: ${(err as Error).message}`);
    }
  }

  async copy(fromFilePath: string, toFilePath: string): Promise<void> {
    try {
      if (!(await this.exists(fromFilePath))) {
        return;
      }
      const sourceUrl = await this.getSignedUrl(fromFilePath, 60);
      const dest = this.blockBlob(toFilePath);
      await dest.syncCopyFromURL(sourceUrl);
    } catch (err) {
      throw new Error(`Failed to copy file: ${(err as Error).message}`);
    }
  }

  async read(filePath: string): Promise<Buffer> {
    try {
      return await this.blockBlob(filePath).downloadToBuffer();
    } catch (err) {
      throw new Error(
        `Failed to read file from Azure: ${(err as Error).message}`,
      );
    }
  }

  async readStream(filePath: string): Promise<Readable> {
    try {
      const response = await this.blockBlob(filePath).download();
      return response.readableStreamBody as Readable;
    } catch (err) {
      throw new Error(
        `Failed to read file from Azure: ${(err as Error).message}`,
      );
    }
  }

  async readRangeStream(
    filePath: string,
    range: { start: number; end: number },
  ): Promise<Readable> {
    try {
      const count = range.end - range.start + 1;
      const response = await this.blockBlob(filePath).download(
        range.start,
        count,
      );
      return response.readableStreamBody as Readable;
    } catch (err) {
      throw new Error(
        `Failed to read file from Azure: ${(err as Error).message}`,
      );
    }
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      return await this.blockBlob(filePath).exists();
    } catch (err) {
      throw new Error(
        `Failed to check existence in Azure: ${(err as Error).message}`,
      );
    }
  }

  getUrl(filePath: string): string {
    const base = this.config.baseUrl ?? this.accountUrl;
    return `${base}/${this.config.container}/${filePath}`;
  }

  async getSignedUrl(filePath: string, expiresIn: number): Promise<string> {
    const expiresOn = new Date(Date.now() + expiresIn * 1000);
    const sas = generateBlobSASQueryParameters(
      {
        containerName: this.config.container,
        blobName: filePath,
        permissions: BlobSASPermissions.parse('r'),
        expiresOn,
        protocol: SASProtocol.HttpsAndHttp,
      },
      this.sharedKeyCredential,
    ).toString();
    return `${this.accountUrl}/${this.config.container}/${filePath}?${sas}`;
  }

  async delete(filePath: string): Promise<void> {
    try {
      await this.blockBlob(filePath).delete();
    } catch (err) {
      throw new Error(
        `Error deleting file ${filePath} from Azure: ${(err as Error).message}`,
      );
    }
  }

  getDriver(): BlobServiceClient {
    return this.blobServiceClient;
  }

  getDriverName(): string {
    return StorageOption.AZURE;
  }

  getConfig(): Record<string, any> {
    return this.config;
  }

  private createBlobServiceClient(): BlobServiceClient {
    return new BlobServiceClient(this.accountUrl, this.sharedKeyCredential);
  }
}
