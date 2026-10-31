import { DynamicModule, Global, Module } from '@nestjs/common';
import {
  mailDriverConfigProvider,
  mailDriverProvider,
} from './providers/mail.provider.js';
import { MailModuleOptions } from './interfaces/index.js';
import { MailService } from './mail.service.js';
import { EmailProcessor } from './processors/email.processor.js';

@Global()
@Module({
  providers: [EmailProcessor],
})
export class MailModule {
  static forRootAsync(options: MailModuleOptions): DynamicModule {
    return {
      module: MailModule,
      imports: options.imports || [],
      providers: [mailDriverConfigProvider, mailDriverProvider, MailService],
      exports: [MailService],
    };
  }
}
