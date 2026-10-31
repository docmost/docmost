import { Module } from '@nestjs/common';
import { ShareController } from './share.controller.js';
import { ShareService } from './share.service.js';
import { TokenModule } from '../auth/token.module.js';
import { ShareSeoController } from './share-seo.controller.js';
import { TransclusionModule } from '../page/transclusion/transclusion.module.js';

@Module({
  imports: [TokenModule, TransclusionModule],
  controllers: [ShareController, ShareSeoController],
  providers: [ShareService],
  exports: [ShareService],
})
export class ShareModule {}
