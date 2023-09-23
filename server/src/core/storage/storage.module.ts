import { DynamicModule, Global, Module } from '@nestjs/common';
import { StorageModuleOptions } from './interfaces';
import { StorageService } from './storage.service';
import {
  storageDriverConfigProvider,
  storageDriverProvider,
} from './providers/storage.provider';

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
