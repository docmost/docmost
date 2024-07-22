import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateWorkspaceDto } from '../dto/create-workspace.dto';
import { UpdateWorkspaceDto } from '../dto/update-workspace.dto';
import { SpaceService } from '../../space/services/space.service';
import { CreateSpaceDto } from '../../space/dto/create-space.dto';
import { SpaceRole, UserRole } from '../../../common/helpers/types/permission';
import { SpaceMemberService } from '../../space/services/space-member.service';
import { WorkspaceRepo } from '@docmost/db/repos/workspace/workspace.repo';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { executeTx } from '@docmost/db/utils';
import { InjectKysely } from 'nestjs-kysely';
import { User } from '@docmost/db/types/entity.types';
import { GroupUserRepo } from '@docmost/db/repos/group/group-user.repo';
import { GroupRepo } from '@docmost/db/repos/group/group.repo';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { PaginationResult } from '@docmost/db/pagination/pagination';
import { UpdateWorkspaceUserRoleDto } from '../dto/update-workspace-user-role.dto';
import { UserRepo } from '@docmost/db/repos/user/user.repo';

@Injectable()
export class WorkspaceService {
  constructor(
    private workspaceRepo: WorkspaceRepo,
    private spaceService: SpaceService,
    private spaceMemberService: SpaceMemberService,
    private groupRepo: GroupRepo,
    private groupUserRepo: GroupUserRepo,
    private userRepo: UserRepo,
    @InjectKysely() private readonly db: KyselyDB,
  ) {}

  async findById(workspaceId: string) {
    return this.workspaceRepo.findById(workspaceId);
  }

  async getWorkspaceInfo(workspaceId: string) {
    const workspace = this.workspaceRepo.findById(workspaceId);
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    return workspace;
  }

  async getWorkspacePublicData(workspaceId: string) {
    const workspace = await this.db
      .selectFrom('workspaces')
      .select(['id'])
      .where('id', '=', workspaceId)
      .executeTakeFirst();
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    return workspace;
  }

  async create(
    user: User,
    createWorkspaceDto: CreateWorkspaceDto,
    trx?: KyselyTransaction,
  ) {
    return await executeTx(
      this.db,
      async (trx) => {
        // create workspace
        const workspace = await this.workspaceRepo.insertWorkspace(
          {
            name: createWorkspaceDto.name,
            hostname: createWorkspaceDto.hostname,
            description: createWorkspaceDto.description,
          },
          trx,
        );

        // create default group
        const group = await this.groupRepo.createDefaultGroup(workspace.id, {
          userId: user.id,
          trx: trx,
        });

        // add user to workspace
        await trx
          .updateTable('users')
          .set({
            workspaceId: workspace.id,
            role: UserRole.OWNER,
          })
          .execute();

        // add user to default group created above
        await this.groupUserRepo.insertGroupUser(
          {
            userId: user.id,
            groupId: group.id,
          },
          trx,
        );

        // create default space
        const spaceInfo: CreateSpaceDto = {
          name: 'General',
          slug: 'general',
        };

        const createdSpace = await this.spaceService.create(
          user.id,
          workspace.id,
          spaceInfo,
          trx,
        );

        // and add user to space as owner
        await this.spaceMemberService.addUserToSpace(
          user.id,
          createdSpace.id,
          SpaceRole.ADMIN,
          workspace.id,
          trx,
        );

        // add default group to space as writer
        await this.spaceMemberService.addGroupToSpace(
          group.id,
          createdSpace.id,
          SpaceRole.WRITER,
          workspace.id,
          trx,
        );

        // update default spaceId
        workspace.defaultSpaceId = createdSpace.id;
        await this.workspaceRepo.updateWorkspace(
          {
            defaultSpaceId: createdSpace.id,
          },
          workspace.id,
          trx,
        );

        return workspace;
      },
      trx,
    );
  }

  async addUserToWorkspace(
    userId: string,
    workspaceId: string,
    assignedRole?: UserRole,
    trx?: KyselyTransaction,
  ): Promise<void> {
    return await executeTx(
      this.db,
      async (trx) => {
        const workspace = await trx
          .selectFrom('workspaces')
          .select(['id', 'defaultRole'])
          .where('workspaces.id', '=', workspaceId)
          .executeTakeFirst();

        if (!workspace) {
          throw new BadRequestException('Workspace not found');
        }

        await trx
          .updateTable('users')
          .set({
            role: assignedRole ?? workspace.defaultRole,
            workspaceId: workspace.id,
          })
          .where('id', '=', userId)
          .execute();
      },
      trx,
    );
  }

  async update(workspaceId: string, updateWorkspaceDto: UpdateWorkspaceDto) {
    const workspace = await this.workspaceRepo.findById(workspaceId);
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    if (updateWorkspaceDto.name) {
      workspace.name = updateWorkspaceDto.name;
    }

    if (updateWorkspaceDto.logo) {
      workspace.logo = updateWorkspaceDto.logo;
    }

    await this.workspaceRepo.updateWorkspace(updateWorkspaceDto, workspaceId);
    return workspace;
  }

  async getWorkspaceUsers(
    workspaceId: string,
    pagination: PaginationOptions,
  ): Promise<PaginationResult<User>> {
    const users = await this.userRepo.getUsersPaginated(
      workspaceId,
      pagination,
    );

    return users;
  }

  async updateWorkspaceUserRole(
    authUser: User,
    userRoleDto: UpdateWorkspaceUserRoleDto,
    workspaceId: string,
  ) {
    const user = await this.userRepo.findById(userRoleDto.userId, workspaceId);

    const newRole = userRoleDto.role.toLowerCase();

    if (!user) {
      throw new BadRequestException('Workspace member not found');
    }

    // prevent ADMIN from managing OWNER role
    if (
      (authUser.role === UserRole.ADMIN && newRole === UserRole.OWNER) ||
      (authUser.role === UserRole.ADMIN && user.role === UserRole.OWNER)
    ) {
      throw new ForbiddenException();
    }

    if (user.role === newRole) {
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
        role: newRole,
      },
      user.id,
      workspaceId,
    );
  }

  async deactivateUser(): Promise<any> {
    return 'todo';
  }
}
