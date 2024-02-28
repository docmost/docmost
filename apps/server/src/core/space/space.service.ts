import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateSpaceDto } from './dto/create-space.dto';
import { Space } from './entities/space.entity';
import { plainToInstance } from 'class-transformer';
import { SpaceRepository } from './repositories/space.repository';
import { SpaceUserRepository } from './repositories/space-user.repository';
import { SpaceUser } from './entities/space-user.entity';

@Injectable()
export class SpaceService {
  constructor(
    private spaceRepository: SpaceRepository,
    private spaceUserRepository: SpaceUserRepository,
  ) {}

  async create(userId: string, workspaceId, createSpaceDto?: CreateSpaceDto) {
    let space: Space;

    if (createSpaceDto) {
      space = plainToInstance(Space, createSpaceDto);
    } else {
      space = new Space();
    }

    space.creatorId = userId;
    space.workspaceId = workspaceId;

    space.name = createSpaceDto?.name ?? 'untitled space';
    space.description = createSpaceDto?.description ?? null;

    space = await this.spaceRepository.save(space);
    return space;
  }

  async addUserToSpace(
    userId: string,
    spaceId: string,
    role: string,
  ): Promise<SpaceUser> {
    const existingSpaceUser = await this.spaceUserRepository.findOne({
      where: { userId: userId, spaceId: spaceId },
    });

    if (existingSpaceUser) {
      throw new BadRequestException('User already added to this space');
    }

    const spaceUser = new SpaceUser();
    spaceUser.userId = userId;
    spaceUser.spaceId = spaceId;
    spaceUser.role = role;

    return this.spaceUserRepository.save(spaceUser);
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
