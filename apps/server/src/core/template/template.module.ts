import { Module } from '@nestjs/common';
import { TemplateService } from './services/template.service';
import { TemplateController } from './template.controller';
import { PageModule } from '../page/page.module';

@Module({
  imports: [PageModule],
  controllers: [TemplateController],
  providers: [TemplateService],
  exports: [TemplateService],
})
export class TemplateModule {}
