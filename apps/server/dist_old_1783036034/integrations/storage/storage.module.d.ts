import { DynamicModule } from '@nestjs/common';
import { StorageModuleOptions } from './interfaces';
export declare class StorageModule {
    static forRootAsync(options: StorageModuleOptions): DynamicModule;
}
