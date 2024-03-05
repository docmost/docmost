import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateSpaceDto } from './dto/create-space.dto';
import { Space } from './entities/space.entity';
import { plainToInstance } from 'class-transformer';
import { SpaceRepository } from './repositories/space.repository';
import { SpaceUserRepository } from './repositories/space-user.repository';
import { SpaceUser } from './entities/space-user.entity';
import { transactionWrapper } from '../../helpers/db.helper';
import { DataSource, EntityManager } from 'typeorm';
import { WorkspaceUser } from '../workspace/entities/workspace-user.entity';
import { User } from '../user/entities/user.entity';

@Injectable()
export class SpaceService {
  constructor(
    private spaceRepository: SpaceRepository,
    private spaceUserRepository: SpaceUserRepository,
    private dataSource: DataSource,
  ) {}

  async create(
    userId: string,
    workspaceId,
    createSpaceDto?: CreateSpaceDto,
    manager?: EntityManager,
  ) {
    let space: Space;

    await transactionWrapper(
      async (manager: EntityManager) => {
        if (createSpaceDto) {
          space = plainToInstance(Space, createSpaceDto);
        } else {
          space = new Space();
        }

        space.creatorId = userId;
        space.workspaceId = workspaceId;

        space.name = createSpaceDto?.name ?? 'untitled space';
        space.description = createSpaceDto?.description ?? null;

        space = await manager.save(space);
      },
      this.dataSource,
      manager,
    );

    return space;
  }

  async addUserToSpace(
    userId: string,
    spaceId: string,
    role: string,
    workspaceId,
    manager?: EntityManager,
  ): Promise<SpaceUser> {
    let addedUser: SpaceUser;

    await transactionWrapper(
      async (manager: EntityManager) => {
        const userExists = await manager.exists(User, {
          where: { id: userId },
        });
        if (!userExists) {
          throw new NotFoundException('User not found');
        }

        // only workspace users can be added to workspace spaces
        const workspaceUser = await manager.findOneBy(WorkspaceUser, {
          userId: userId,
          workspaceId: workspaceId,
        });

        if (!workspaceUser) {
          throw new NotFoundException('User is not a member of this workspace');
        }

        const existingSpaceUser = await manager.findOneBy(SpaceUser, {
          userId: userId,
          spaceId: spaceId,
        });

        if (existingSpaceUser) {
          throw new BadRequestException('User already added to this space');
        }

        const spaceUser = new SpaceUser();
        spaceUser.userId = userId;
        spaceUser.spaceId = spaceId;
        spaceUser.role = role;

        addedUser = await manager.save(spaceUser);
      },
      this.dataSource,
      manager,
    );

    return addedUser;
  }

  async getUserSpacesInWorkspace(userId: string, workspaceId: string) {
    const spaces = await this.spaceUserRepository.find({
      relations: ['space'],
      where: {
        userId: userId,
        space: {
          workspaceId: workspaceId,
        },
      },
    });

    return spaces.map((userSpace: SpaceUser) => userSpace.space);
  }
}
