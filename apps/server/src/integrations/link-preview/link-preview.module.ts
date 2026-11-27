import { Module } from '@nestjs/common';
import { LinkPreviewController } from './link-preview.controller';
import { LinkPreviewService } from './link-preview.service';

@Module({
  controllers: [LinkPreviewController],
  providers: [LinkPreviewService],
})
export class LinkPreviewModule {}
