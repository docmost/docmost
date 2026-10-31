import { Module } from '@nestjs/common';
import { PublicSpaceController } from './public-space.controller.js';
import { PublicSpaceSeoController } from './public-space-seo.controller.js';
import { PublicSpaceService } from './public-space.service.js';
import { ShareModule } from '../share/share.module.js';
import { TransclusionModule } from '../page/transclusion/transclusion.module.js';

@Module({
  imports: [ShareModule, TransclusionModule],
  controllers: [PublicSpaceController, PublicSpaceSeoController],
  providers: [PublicSpaceService],
  exports: [PublicSpaceService],
})
export class PublicSpaceModule {}
