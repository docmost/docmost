import { Module } from '@nestjs/common';
import { RobotsTxtController } from './robots.txt.controller';

@Module({
  controllers: [RobotsTxtController],
})
export class SecurityModule {}
