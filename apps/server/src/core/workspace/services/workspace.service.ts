import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateWorkspaceDto } from '../dto/create-workspace.dto';
import { WorkspaceRepository } from '../repositories/workspace.repository';
import { Workspace } from '../entities/workspace.entity';
import { v4 as uuidv4 } from 'uuid';
import { UpdateWorkspaceDto } from '../dto/update-workspace.dto';
import { DeleteWorkspaceDto } from '../dto/delete-workspace.dto';
import { SpaceService } from '../../space/space.service';
import { DataSource, EntityManager } from 'typeorm';
import { transactionWrapper } from '../../../helpers/db.helper';
import { CreateSpaceDto } from '../../space/dto/create-space.dto';
import { UserRepository } from '../../user/repositories/user.repository';
import { SpaceRole, UserRole } from '../../../helpers/types/permission';
import { User } from '../../user/entities/user.entity';
import { EnvironmentService } from '../../../environment/environment.service';
import { Space } from '../../space/entities/space.entity';

@Injectable()
export class WorkspaceService {
  constructor(
    private workspaceRepository: WorkspaceRepository,
    private userRepository: UserRepository,
    private spaceService: SpaceService,
    private environmentService: EnvironmentService,

    private dataSource: DataSource,
  ) {}

  async findById(workspaceId: string): Promise<Workspace> {
    return this.workspaceRepository.findById(workspaceId);
  }

  async getWorkspaceInfo(workspaceId: string): Promise<Workspace> {
    const space = await this.workspaceRepository
      .createQueryBuilder('workspace')
      .where('workspace.id = :workspaceId', { workspaceId })
      .loadRelationCountAndMap(
        'workspace.userCount',
        'workspace.users',
        'workspaceUsers',
      )
      .getOne();

    if (!space) {
      throw new NotFoundException('Workspace not found');
    }

    return space;
  }

  async create(
    user: User,
    createWorkspaceDto: CreateWorkspaceDto,
    manager?: EntityManager,
  ): Promise<Workspace> {
    return await transactionWrapper(
      async (manager) => {
        let workspace = new Workspace();

        workspace.name = createWorkspaceDto.name;
        workspace.hostname = createWorkspaceDto?.hostname;
        workspace.description = createWorkspaceDto.description;
        workspace.inviteCode = uuidv4();
        workspace.creatorId = user.id;
        workspace = await manager.save(workspace);

        user.workspaceId = workspace.id;
        user.role = UserRole.OWNER;
        await manager.save(user);

        // create default space
        const spaceData: CreateSpaceDto = {
          name: 'General',
        };

        // create default space
        const createdSpace = await this.spaceService.create(
          user.id,
          workspace.id,
          spaceData,
          manager,
        );

        // and add user to it too.
        await this.spaceService.addUserToSpace(
          user.id,
          createdSpace.id,
          SpaceRole.OWNER,
          workspace.id,
          manager,
        );

        workspace.defaultSpaceId = createdSpace.id;
        await manager.save(workspace);
        return workspace;
      },
      this.dataSource,
      manager,
    );
  }

  async addUserToWorkspace(
    user: User,
    workspaceId,
    assignedRole?: UserRole,
    manager?: EntityManager,
  ): Promise<Workspace> {
    return await transactionWrapper(
      async (manager: EntityManager) => {
        const workspace = await manager.findOneBy(Workspace, {
          id: workspaceId,
        });

        if (!workspace) {
          throw new BadRequestException('Workspace does not exist');
        }

        user.role = assignedRole ?? workspace.defaultRole;
        user.workspaceId = workspace.id;
        await manager.save(user);

        const space = await manager.findOneBy(Space, {
          id: workspace.defaultSpaceId,
          workspaceId,
        });

        if (!space) {
          throw new NotFoundException('Space not found');
        }

        // add user to default space
        await this.spaceService.addUserToSpace(
          user.id,
          space.id,
          space.defaultRole,
          workspace.id,
          manager,
        );

        return workspace;
      },
      this.dataSource,
      manager,
    );
  }

  async update(
    workspaceId: string,
    updateWorkspaceDto: UpdateWorkspaceDto,
  ): Promise<Workspace> {
    const workspace = await this.workspaceRepository.findById(workspaceId);
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    if (updateWorkspaceDto.name) {
      workspace.name = updateWorkspaceDto.name;
    }

    if (updateWorkspaceDto.logo) {
      workspace.logo = updateWorkspaceDto.logo;
    }

    return this.workspaceRepository.save(workspace);
  }

  async delete(deleteWorkspaceDto: DeleteWorkspaceDto): Promise<void> {
    const workspace = await this.workspaceRepository.findById(
      deleteWorkspaceDto.workspaceId,
    );
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    //TODO
    // remove all existing users from workspace
    // delete workspace
  }
}
