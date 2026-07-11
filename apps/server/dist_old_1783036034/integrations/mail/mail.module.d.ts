import { DynamicModule } from '@nestjs/common';
import { MailModuleOptions } from './interfaces';
export declare class MailModule {
    static forRootAsync(options: MailModuleOptions): DynamicModule;
}
