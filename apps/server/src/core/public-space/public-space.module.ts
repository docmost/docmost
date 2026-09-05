import { Module } from '@nestjs/common';
import { PublicSpaceController } from './public-space.controller';
import { PublicSpaceSeoController } from './public-space-seo.controller';
import { PublicSpaceService } from './public-space.service';
import { ShareModule } from '../share/share.module';
import { TransclusionModule } from '../page/transclusion/transclusion.module';

@Module({
  imports: [ShareModule, TransclusionModule],
  controllers: [PublicSpaceController, PublicSpaceSeoController],
  providers: [PublicSpaceService],
  exports: [PublicSpaceService],
})
export class PublicSpaceModule {}
