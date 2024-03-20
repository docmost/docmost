import { Module } from '@nestjs/common';
import { SpaceService } from './space.service';
import { SpaceController } from './space.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Space } from './entities/space.entity';
import { SpaceUser } from './entities/space-user.entity';
import { SpaceRepository } from './repositories/space.repository';
import { SpaceUserRepository } from './repositories/space-user.repository';
import { SpaceGroup } from './entities/space-group.entity';
import { SpaceGroupRepository } from './repositories/space-group.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Space, SpaceUser, SpaceGroup])],
  controllers: [SpaceController],
  providers: [
    SpaceService,
    SpaceRepository,
    SpaceUserRepository,
    SpaceGroupRepository,
  ],
  exports: [SpaceService],
})
export class SpaceModule {}
