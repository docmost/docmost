import { Module } from '@nestjs/common';
import { SpaceService } from './services/space.service';
import { SpaceController } from './space.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Space } from './entities/space.entity';
import { SpaceRepository } from './repositories/space.repository';
import { SpaceMember } from './entities/space-member.entity';
import { SpaceMemberRepository } from './repositories/space-member.repository';
import { SpaceMemberService } from './services/space-member.service';

@Module({
  imports: [TypeOrmModule.forFeature([Space, SpaceMember])],
  controllers: [SpaceController],
  providers: [
    SpaceService,
    SpaceMemberService,
    SpaceRepository,
    SpaceMemberRepository,
  ],
  exports: [SpaceService, SpaceMemberService],
})
export class SpaceModule {}
