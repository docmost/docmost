import { BadRequestException, Injectable } from '@nestjs/common';
import { UpdateWorkspaceUserRoleDto } from '../dto/update-workspace-user-role.dto';
import { PaginationOptions } from '../../../helpers/pagination/pagination-options';
import { PaginationMetaDto } from '../../../helpers/pagination/pagination-meta-dto';
import { PaginatedResult } from '../../../helpers/pagination/paginated-result';
import { User } from '../../user/entities/user.entity';
import { WorkspaceRepository } from '../repositories/workspace.repository';
import { UserRepository } from '../../user/repositories/user.repository';
import { UserRole } from '../../../helpers/types/permission';

@Injectable()
export class WorkspaceUserService {
  constructor(
    private workspaceRepository: WorkspaceRepository,
    private userRepository: UserRepository,
  ) {}

  async getWorkspaceUsers(
    workspaceId: string,
    paginationOptions: PaginationOptions,
  ): Promise<PaginatedResult<User>> {
    const [workspaceUsers, count] = await this.userRepository.findAndCount({
      where: {
        workspaceId,
      },
      take: paginationOptions.limit,
      skip: paginationOptions.skip,
    });

    const paginationMeta = new PaginationMetaDto({ count, paginationOptions });
    return new PaginatedResult(workspaceUsers, paginationMeta);
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

    const workspaceOwnerCount = await this.userRepository.count({
      where: {
        role: UserRole.OWNER,
        workspaceId,
      },
    });

    if (workspaceUser.role === UserRole.OWNER && workspaceOwnerCount === 1) {
      throw new BadRequestException(
        'There must be at least one workspace owner',
      );
    }

    workspaceUser.role = workspaceUserRoleDto.role;

    return this.userRepository.save(workspaceUser);
  }

  async deactivateUser(): Promise<any> {
    return 'todo';
  }

  async findWorkspaceUser(userId: string, workspaceId: string): Promise<User> {
    return await this.userRepository.findOneBy({
      id: userId,
      workspaceId,
    });
  }

  async findWorkspaceUserByEmail(
    email: string,
    workspaceId: string,
  ): Promise<User> {
    return await this.userRepository.findOneBy({
      email: email,
      workspaceId,
    });
  }

  async findAndValidateWorkspaceUser(
    userId: string,
    workspaceId: string,
  ): Promise<User> {
    const user = await this.findWorkspaceUser(userId, workspaceId);

    if (!user) {
      throw new BadRequestException('Workspace member not found');
    }

    return user;
  }
}
