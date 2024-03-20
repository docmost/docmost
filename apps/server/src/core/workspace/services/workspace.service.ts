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
import { GroupService } from '../../group/services/group.service';
import { GroupUserService } from '../../group/services/group-user.service';

@Injectable()
export class WorkspaceService {
  constructor(
    private workspaceRepository: WorkspaceRepository,
    private userRepository: UserRepository,
    private spaceService: SpaceService,
    private groupService: GroupService,
    private groupUserService: GroupUserService,
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

        // create default group
        const group = await this.groupService.createDefaultGroup(
          workspace.id,
          user.id,
          manager,
        );

        // attach user to workspace
        user.workspaceId = workspace.id;
        user.role = UserRole.OWNER;
        await manager.save(user);

        // add user to default group
        await this.groupUserService.addUserToGroup(
          user.id,
          group.id,
          workspace.id,
          manager,
        );

        // create default space
        const spaceInfo: CreateSpaceDto = {
          name: 'General',
        };

        // create default space
        const createdSpace = await this.spaceService.create(
          user.id,
          workspace.id,
          spaceInfo,
          manager,
        );

        // and add user to space as owner
        await this.spaceService.addUserToSpace(
          user.id,
          createdSpace.id,
          SpaceRole.OWNER,
          workspace.id,
          manager,
        );

        // add default group to space as writer
        await this.spaceService.addGroupToSpace(
          group.id,
          createdSpace.id,
          SpaceRole.WRITER,
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
  ): Promise<void> {
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

        // User is now added to the default space via the default group
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
    // delete
  }
}
