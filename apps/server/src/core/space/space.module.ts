import { Module } from '@nestjs/common';
import { SpaceService } from './services/space.service.js';
import { SpaceController } from './space.controller.js';
import { SpaceMemberService } from './services/space-member.service.js';

@Module({
  imports: [],
  controllers: [SpaceController],
  providers: [SpaceService, SpaceMemberService],
  exports: [SpaceService, SpaceMemberService],
})
export class SpaceModule {}
