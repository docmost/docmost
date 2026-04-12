import { Module } from '@nestjs/common';
import { NextcloudController } from './nextcloud.controller';
import { NextcloudService } from './nextcloud.service';

@Module({
  controllers: [NextcloudController],
  providers: [NextcloudService],
})
export class NextcloudModule {}
