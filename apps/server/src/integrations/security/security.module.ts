import { Module } from '@nestjs/common';
import { RobotsTxtController } from './robots.txt.controller.js';
import { VersionController } from './version.controller.js';
import { VersionService } from './version.service.js';

@Module({
  controllers: [RobotsTxtController, VersionController],
  providers: [VersionService],
})
export class SecurityModule {}
