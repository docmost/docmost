import {
  STORAGE_CONFIG_TOKEN,
  STORAGE_DRIVER_TOKEN,
} from '../constants/storage.constants';
import { EnvironmentService } from '../../environment/environment.service';
import {
  LocalStorageConfig,
  S3StorageConfig,
  StorageConfig,
  StorageDriver,
  StorageOption,
} from '../interfaces';
import { LocalDriver, S3Driver } from '../drivers';
import * as process from 'node:process';
import { LOCAL_STORAGE_PATH } from '../../../common/helpers';

function createStorageDriver(disk: StorageConfig): StorageDriver {
  switch (disk.driver) {
    case StorageOption.LOCAL:
      return new LocalDriver(disk.config as LocalStorageConfig);
    case StorageOption.S3:
      return new S3Driver(disk.config as S3StorageConfig);
    default:
      throw new Error(`Unknown storage driver`);
  }
}

export const storageDriverConfigProvider = {
  provide: STORAGE_CONFIG_TOKEN,
  useFactory: async (environmentService: EnvironmentService) => {
    const driver = environmentService.getStorageDriver().toLowerCase();

    switch (driver) {
      case StorageOption.LOCAL:
        return {
          driver,
          config: {
            storagePath: process.cwd() + '/' + LOCAL_STORAGE_PATH,
          },
        };

      case StorageOption.S3:
        return {
          driver,
          config: {
            region: environmentService.getAwsS3Region(),
            endpoint: environmentService.getAwsS3Endpoint(),
            bucket: environmentService.getAwsS3Bucket(),
            baseUrl: environmentService.getAwsS3Url(),
            credentials: {
              accessKeyId: environmentService.getAwsS3AccessKeyId(),
              secretAccessKey: environmentService.getAwsS3SecretAccessKey(),
            },
          },
        };

      default:
        throw new Error(`Unknown storage driver: ${driver}`);
    }
  },

  inject: [EnvironmentService],
};

export const storageDriverProvider = {
  provide: STORAGE_DRIVER_TOKEN,
  useFactory: (config: StorageConfig) => createStorageDriver(config),
  inject: [STORAGE_CONFIG_TOKEN],
};
