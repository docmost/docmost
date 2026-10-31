import { DynamicModule, Global, Module } from '@nestjs/common';
import { StorageModuleOptions } from './interfaces/index.js';
import { StorageService } from './storage.service.js';
import {
  storageDriverConfigProvider,
  storageDriverProvider,
} from './providers/storage.provider.js';

@Global()
@Module({})
export class StorageModule {
  static forRootAsync(options: StorageModuleOptions): DynamicModule {
    return {
      module: StorageModule,
      imports: options.imports || [],
      providers: [
        storageDriverConfigProvider,
        storageDriverProvider,
        StorageService,
      ],
      exports: [StorageService],
    };
  }
}
