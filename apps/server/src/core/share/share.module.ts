import { Module } from '@nestjs/common';
import { ShareController } from './share.controller';
import { ShareService } from './share.service';
import { TokenModule } from '../auth/token.module';
import { ShareSeoController } from './share-seo.controller';

@Module({
  imports: [TokenModule],
  controllers: [ShareController, ShareSeoController],
  providers: [ShareService],
  exports: [ShareService],
})
export class ShareModule {}
