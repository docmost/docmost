import { Module } from '@nestjs/common';
import { TemplateService } from './template.service';
import { TemplateController } from './template.controller';
import { PageModule } from '../../core/page/page.module';
import { PageAccessModule } from '../../core/page/page-access/page-access.module';

@Module({
  imports: [PageModule, PageAccessModule],
  providers: [TemplateService],
  controllers: [TemplateController],
})
export class TemplateModule {}
