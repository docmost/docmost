import { Module } from '@nestjs/common';
import { SpaceService } from './space.service';
import { SpaceController } from './space.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Space } from './entities/space.entity';
import { SpaceUser } from './entities/space-user.entity';
import { SpaceRepository } from './repositories/space.repository';
import { SpaceUserRepository } from './repositories/space-user.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Space, SpaceUser])],
  controllers: [SpaceController],
  providers: [SpaceService, SpaceRepository, SpaceUserRepository],
  exports: [SpaceService, SpaceRepository, SpaceUserRepository],
})
export class SpaceModule {}
