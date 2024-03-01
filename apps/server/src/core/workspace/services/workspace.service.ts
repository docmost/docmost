import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateWorkspaceDto } from '../dto/create-workspace.dto';
import { WorkspaceRepository } from '../repositories/workspace.repository';
import { WorkspaceUserRepository } from '../repositories/workspace-user.repository';
import {
  WorkspaceUser,
  WorkspaceUserRole,
} from '../entities/workspace-user.entity';
import { Workspace } from '../entities/workspace.entity';
import { plainToInstance } from 'class-transformer';
import { v4 as uuid } from 'uuid';
import { UpdateWorkspaceDto } from '../dto/update-workspace.dto';
import { DeleteWorkspaceDto } from '../dto/delete-workspace.dto';
import { UpdateWorkspaceUserRoleDto } from '../dto/update-workspace-user-role.dto';
import { SpaceService } from '../../space/space.service';
import { PaginationOptions } from '../../../helpers/pagination/pagination-options';
import { PaginationMetaDto } from '../../../helpers/pagination/pagination-meta-dto';
import { PaginatedResult } from '../../../helpers/pagination/paginated-result';
import { User } from '../../user/entities/user.entity';
import { DataSource, EntityManager } from 'typeorm';
import { transactionWrapper } from '../../../helpers/db.helper';
import { CreateSpaceDto } from '../../space/dto/create-space.dto';

@Injectable()
export class WorkspaceService {
  constructor(
    private workspaceRepository: WorkspaceRepository,
    private workspaceUserRepository: WorkspaceUserRepository,
    private spaceService: SpaceService,
    private dataSource: DataSource,
  ) {}

  async findById(workspaceId: string): Promise<Workspace> {
    return this.workspaceRepository.findById(workspaceId);
  }

  async save(workspace: Workspace) {
    return this.workspaceRepository.save(workspace);
  }

  async createOrJoinWorkspace(
    userId,
    createWorkspaceDto?: CreateWorkspaceDto,
    manager?: EntityManager,
  ) {
    await transactionWrapper(
      async (manager: EntityManager) => {
        const workspaceCount = await manager
          .createQueryBuilder(Workspace, 'workspace')
          .getCount();

        if (workspaceCount === 0) {
          // create first workspace and add user to workspace as owner
          const createdWorkspace = await this.create(
            userId,
            createWorkspaceDto ?? null,
            manager,
          );
          await this.addUserToWorkspace(
            userId,
            createdWorkspace.id,
            WorkspaceUserRole.OWNER,
            manager,
          );

          // create default space and add user to it too.
          const createdSpace = await this.spaceService.create(
            userId,
            createdWorkspace.id,
            { name: 'General' } as CreateSpaceDto,
            manager,
          );

          await this.spaceService.addUserToSpace(
            userId,
            createdSpace.id,
            WorkspaceUserRole.OWNER,
            manager,
          );

          createdWorkspace.defaultSpaceId = createdSpace.id;
          await manager.save(createdWorkspace);
        } else {
          // limited to single workspace
          // fetch the oldest workspace and add user to it
          const firstWorkspace = await manager.find(Workspace, {
            order: {
              createdAt: 'ASC',
            },
            take: 1,
          });

          // add user to workspace and default space

          await this.addUserToWorkspace(
            userId,
            firstWorkspace[0].id,
            WorkspaceUserRole.MEMBER,
            manager,
          );

          await this.spaceService.addUserToSpace(
            userId,
            firstWorkspace[0].defaultSpaceId,
            WorkspaceUserRole.MEMBER,
            manager,
          );
        }
      },
      this.dataSource,
      manager,
    );
  }

  async create(
    userId: string,
    createWorkspaceDto?: CreateWorkspaceDto,
    manager?: EntityManager,
  ): Promise<Workspace> {
    let workspace: Workspace;

    await transactionWrapper(
      async (manager) => {
        if (createWorkspaceDto) {
          workspace = plainToInstance(Workspace, createWorkspaceDto);
        } else {
          workspace = new Workspace();
        }

        workspace.inviteCode = uuid();
        workspace.creatorId = userId;

        //if (workspace.name && !workspace.hostname?.trim()) {
        //  workspace.hostname = generateHostname(createWorkspaceDto.name);
        // }

        workspace = await manager.save(workspace);
      },
      this.dataSource,
      manager,
    );

    return workspace;
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

  async addUserToWorkspace(
    userId: string,
    workspaceId: string,
    role: string,
    manager?: EntityManager,
  ): Promise<WorkspaceUser> {
    let addedUser;

    await transactionWrapper(
      async (manager) => {
        const existingWorkspaceUser = await manager.findOne(WorkspaceUser, {
          where: { userId: userId, workspaceId: workspaceId },
        });

        const userExists = await manager.exists(User, {
          where: { id: userId },
        });
        if (!userExists) {
          throw new NotFoundException('User not found');
        }

        if (existingWorkspaceUser) {
          throw new BadRequestException(
            'User is already a member of this workspace',
          );
        }

        const workspaceUser = new WorkspaceUser();
        workspaceUser.userId = userId;
        workspaceUser.workspaceId = workspaceId;
        workspaceUser.role = role;

        addedUser = await manager.save(workspaceUser);
      },
      this.dataSource,
      manager,
    );

    return addedUser;
  }

  async updateWorkspaceUserRole(
    authUser: User,
    workspaceUserRoleDto: UpdateWorkspaceUserRoleDto,
    workspaceId: string,
  ) {
    const workspaceUser = await this.getWorkspaceUser(
      workspaceUserRoleDto.userId,
      workspaceId,
    );

    if (workspaceUser.role === workspaceUserRoleDto.role) {
      return workspaceUser;
    }

    const workspaceOwnerCount = await this.workspaceUserRepository.count({
      where: {
        role: WorkspaceUserRole.OWNER,
      },
    });

    if (
      workspaceUser.role === WorkspaceUserRole.OWNER &&
      workspaceOwnerCount === 1
    ) {
      throw new BadRequestException(
        'There must be at least one workspace owner',
      );
    }

    workspaceUser.role = workspaceUserRoleDto.role;

    return this.workspaceUserRepository.save(workspaceUser);
  }

  async removeUserFromWorkspace(
    userId: string,
    workspaceId: string,
  ): Promise<void> {
    await this.getWorkspaceUser(userId, workspaceId);

    const workspaceUser = await this.getWorkspaceUser(userId, workspaceId);

    const workspaceOwnerCount = await this.workspaceUserRepository.count({
      where: {
        role: WorkspaceUserRole.OWNER,
      },
    });

    if (
      workspaceUser.role === WorkspaceUserRole.OWNER &&
      workspaceOwnerCount === 1
    ) {
      throw new BadRequestException(
        'There must be at least one workspace owner',
      );
    }

    await this.workspaceUserRepository.delete({
      userId,
      workspaceId,
    });
  }

  async getUserCurrentWorkspace(userId: string): Promise<Workspace> {
    const userWorkspace = await this.workspaceUserRepository.findOne({
      where: { userId: userId },
      relations: ['workspace'],
      order: {
        createdAt: 'ASC',
      },
    });

    if (!userWorkspace) {
      throw new NotFoundException('No workspace found for this user');
    }

    return userWorkspace.workspace;
  }

  async getUserWorkspaces(
    userId: string,
    paginationOptions: PaginationOptions,
  ): Promise<PaginatedResult<Workspace>> {
    const [workspaces, count] = await this.workspaceUserRepository.findAndCount(
      {
        where: { userId: userId },
        relations: ['workspace'],
        take: paginationOptions.limit,
        skip: paginationOptions.skip,
      },
    );

    const userWorkspaces = workspaces.map(
      (userWorkspace: WorkspaceUser) => userWorkspace.workspace,
    );

    const paginationMeta = new PaginationMetaDto({ count, paginationOptions });
    return new PaginatedResult(userWorkspaces, paginationMeta);
  }

  async getWorkspaceUsers(
    workspaceId: string,
    paginationOptions: PaginationOptions,
  ): Promise<PaginatedResult<any>> {
    const [workspaceUsers, count] =
      await this.workspaceUserRepository.findAndCount({
        relations: ['user'],
        where: {
          workspace: {
            id: workspaceId,
          },
        },
        take: paginationOptions.limit,
        skip: paginationOptions.skip,
      });

    const users = workspaceUsers.map((workspaceUser) => {
      workspaceUser.user.password = '';
      return {
        ...workspaceUser.user,
        role: workspaceUser.role,
      };
    });

    const paginationMeta = new PaginationMetaDto({ count, paginationOptions });
    return new PaginatedResult(users, paginationMeta);
  }

  async getUserRoleInWorkspace(
    userId: string,
    workspaceId: string,
  ): Promise<string> {
    const workspaceUser = await this.getWorkspaceUser(userId, workspaceId);
    return workspaceUser.role ? workspaceUser.role : null;
  }

  async getWorkspaceUser(
    userId: string,
    workspaceId: string,
  ): Promise<WorkspaceUser> {
    const workspaceUser = await this.workspaceUserRepository.findOne({
      where: { userId, workspaceId },
    });

    if (!workspaceUser) {
      throw new BadRequestException('Workspace member not found');
    }

    return workspaceUser;
  }
}
