import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { WorkspaceUserRepository } from '../repositories/workspace-user.repository';
import {
  WorkspaceUser,
  WorkspaceUserRole,
} from '../entities/workspace-user.entity';
import { Workspace } from '../entities/workspace.entity';
import { UpdateWorkspaceUserRoleDto } from '../dto/update-workspace-user-role.dto';
import { PaginationOptions } from '../../../helpers/pagination/pagination-options';
import { PaginationMetaDto } from '../../../helpers/pagination/pagination-meta-dto';
import { PaginatedResult } from '../../../helpers/pagination/paginated-result';
import { User } from '../../user/entities/user.entity';
import { DataSource, EntityManager } from 'typeorm';
import { transactionWrapper } from '../../../helpers/db.helper';

@Injectable()
export class WorkspaceUserService {
  constructor(
    private workspaceUserRepository: WorkspaceUserRepository,
    private dataSource: DataSource,
  ) {}

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
    const workspaceUser = await this.findAndValidateWorkspaceUser(
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
    const workspaceUser = await this.findAndValidateWorkspaceUser(
      userId,
      workspaceId,
    );

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
    const workspaceUser = await this.findAndValidateWorkspaceUser(
      userId,
      workspaceId,
    );
    return workspaceUser.role ? workspaceUser.role : null;
  }

  async findWorkspaceUser(
    userId: string,
    workspaceId: string,
  ): Promise<WorkspaceUser> {
    return await this.workspaceUserRepository.findOneBy({
      userId,
      workspaceId,
    });
  }

  async findAndValidateWorkspaceUser(
    userId: string,
    workspaceId: string,
  ): Promise<WorkspaceUser> {
    const workspaceUser = await this.findWorkspaceUser(userId, workspaceId);

    if (!workspaceUser) {
      throw new BadRequestException('Workspace member not found');
    }

    return workspaceUser;
  }
}
