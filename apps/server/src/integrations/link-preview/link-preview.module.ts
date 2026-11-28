import { Module } from '@nestjs/common';
import { LinkPreviewController } from './link-preview.controller';
import { LinkPreviewService } from './link-preview.service';
import { IframelyClient } from './iframely.client';

@Module({
  controllers: [LinkPreviewController],
  providers: [LinkPreviewService, IframelyClient],
})
export class LinkPreviewModule {}
