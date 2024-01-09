import { S3ClientConfig } from '@aws-sdk/client-s3';

export enum StorageOption {
  LOCAL = 'local',
  S3 = 's3',
}

export type StorageConfig =
  | { driver: StorageOption.LOCAL; config: LocalStorageConfig }
  | { driver: StorageOption.S3; config: S3StorageConfig };

export interface LocalStorageConfig {
  storagePath: string;
}

export interface S3StorageConfig
  extends Omit<S3ClientConfig, 'endpoint' | 'bucket'> {
  endpoint: string; // Enforce endpoint
  bucket: string; // Enforce bucket
  baseUrl?: string; // Optional CDN URL for assets
}

export interface StorageOptions {
  disk: StorageConfig;
}

export interface StorageOptionsFactory {
  createStorageOptions(): Promise<StorageConfig> | StorageConfig;
}

export interface StorageModuleOptions {
  imports?: any[];
}
