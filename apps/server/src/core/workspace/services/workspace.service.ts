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
import { WorkspaceUserService } from './workspace-user.service';

@Injectable()
export class WorkspaceService {
  constructor(
    private workspaceRepository: WorkspaceRepository,
    private workspaceUserRepository: WorkspaceUserRepository,
    private spaceService: SpaceService,
    private workspaceUserService: WorkspaceUserService,

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
          await this.workspaceUserService.addUserToWorkspace(
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
            createdWorkspace.id,
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

          await this.workspaceUserService.addUserToWorkspace(
            userId,
            firstWorkspace[0].id,
            WorkspaceUserRole.MEMBER,
            manager,
          );

          await this.spaceService.addUserToSpace(
            userId,
            firstWorkspace[0].defaultSpaceId,
            WorkspaceUserRole.MEMBER,
            firstWorkspace[0].id,
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
}
