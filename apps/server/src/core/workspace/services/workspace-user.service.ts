import { BadRequestException, Injectable } from '@nestjs/common';
import { UpdateWorkspaceUserRoleDto } from '../dto/update-workspace-user-role.dto';
import { PaginationOptions } from '../../../helpers/pagination/pagination-options';
import { PaginationMetaDto } from '../../../helpers/pagination/pagination-meta-dto';
import { PaginatedResult } from '../../../helpers/pagination/paginated-result';
import { UserRole } from '../../../helpers/types/permission';
import { UserRepo } from '@docmost/db/repos/user/user.repo';
import { User } from '@docmost/db/types/entity.types';

@Injectable()
export class WorkspaceUserService {
  constructor(private userRepo: UserRepo) {}

  async getWorkspaceUsers(
    workspaceId: string,
    paginationOptions: PaginationOptions,
  ): Promise<PaginatedResult<any>> {
    const { users, count } = await this.userRepo.getUsersPaginated(
      workspaceId,
      paginationOptions,
    );

    const paginationMeta = new PaginationMetaDto({ count, paginationOptions });
    return new PaginatedResult(users, paginationMeta);
  }

  async updateWorkspaceUserRole(
    authUser: User,
    userRoleDto: UpdateWorkspaceUserRoleDto,
    workspaceId: string,
  ) {
    const user = await this.userRepo.findById(userRoleDto.userId, workspaceId);

    if (!user) {
      throw new BadRequestException('Workspace member not found');
    }

    if (user.role === userRoleDto.role) {
      return user;
    }

    const workspaceOwnerCount = await this.userRepo.roleCountByWorkspaceId(
      UserRole.OWNER,
      workspaceId,
    );

    if (user.role === UserRole.OWNER && workspaceOwnerCount === 1) {
      throw new BadRequestException(
        'There must be at least one workspace owner',
      );
    }

    await this.userRepo.updateUser(
      {
        role: userRoleDto.role,
      },
      user.id,
      workspaceId,
    );
  }

  async deactivateUser(): Promise<any> {
    return 'todo';
  }
}
