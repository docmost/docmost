import { Module } from '@nestjs/common';
import { RobotsTxtController } from './robots.txt.controller';
import { VersionController } from './version.controller';
import { VersionService } from './version.service';

@Module({
  controllers: [RobotsTxtController, VersionController],
  providers: [VersionService],
})
export class SecurityModule {}
