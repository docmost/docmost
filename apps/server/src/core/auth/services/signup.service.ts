import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateUserDto } from '../dto/create-user.dto';
import { WorkspaceService } from '../../workspace/services/workspace.service';
import { CreateWorkspaceDto } from '../../workspace/dto/create-workspace.dto';
import { CreateAdminUserDto } from '../dto/create-admin-user.dto';
import { UserRepo } from '@docmost/db/repos/user/user.repo';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { executeTx } from '@docmost/db/utils';
import { InjectKysely } from 'nestjs-kysely';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { GroupUserRepo } from '@docmost/db/repos/group/group-user.repo';
import {
  SpaceRole,
  SpaceVisibility,
  UserRole,
} from '../../../common/helpers/types/permission';
import { SpaceRepo } from '@docmost/db/repos/space/space.repo';
import { SpaceMemberService } from 'src/core/space/services/space-member.service';

@Injectable()
export class SignupService {
  constructor(
    private userRepo: UserRepo,
    private workspaceService: WorkspaceService,
    private groupUserRepo: GroupUserRepo,
    private readonly spaceRepo: SpaceRepo,
    private readonly spaceMemberService: SpaceMemberService,
    @InjectKysely() private readonly db: KyselyDB,
  ) {}

  async signup(
    createUserDto: CreateUserDto,
    workspaceId: string,
    trx?: KyselyTransaction,
  ): Promise<User> {
    const userCheck = await this.userRepo.findByEmail(
      createUserDto.email,
      workspaceId,
    );

    if (userCheck) {
      throw new BadRequestException(
        'An account with this email already exists in this workspace',
      );
    }

    return await executeTx(
      this.db,
      async (trx) => {
        // create user
        const user = await this.userRepo.insertUser(
          {
            ...createUserDto,
            workspaceId: workspaceId,
          },
          trx,
        );

        // add user to workspace
        await this.workspaceService.addUserToWorkspace(
          user.id,
          workspaceId,
          undefined,
          trx,
        );

        // add user to default group
        await this.groupUserRepo.addUserToDefaultGroup(
          user.id,
          workspaceId,
          trx,
        );

        // create user's space
        const userSpace = await this.spaceRepo.insertSpace(
          {
            name: `${user.name}'s Space`,
            workspaceId,
            creatorId: user.id,
            visibility: SpaceVisibility.PERSONAL,
            slug: `${user.id}-space`,
          },
          trx,
        );
        await this.spaceMemberService.addUserToSpace(
          user.id,
          userSpace.id,
          SpaceRole.ADMIN,
          workspaceId,
          trx,
        );

        return user;
      },
      trx,
    );
  }

  async initialSetup(
    createAdminUserDto: CreateAdminUserDto,
    trx?: KyselyTransaction,
  ) {
    let user: User,
      workspace: Workspace = null;

    await executeTx(
      this.db,
      async (trx) => {
        // create user
        user = await this.userRepo.insertUser(
          {
            name: createAdminUserDto.name,
            email: createAdminUserDto.email,
            password: createAdminUserDto.password,
            role: UserRole.OWNER,
            emailVerifiedAt: new Date(),
          },
          trx,
        );

        // create workspace with full setup
        const workspaceData: CreateWorkspaceDto = {
          name: createAdminUserDto.workspaceName,
        };

        workspace = await this.workspaceService.create(
          user,
          workspaceData,
          trx,
        );

        user.workspaceId = workspace.id;

        // create user's space
        const userSpace = await this.spaceRepo.insertSpace(
          {
            name: `${user.name}'s Space`,
            workspaceId: workspace.id,
            creatorId: user.id,
            slug: `${user.id}-space`,
            visibility: SpaceVisibility.PERSONAL,
          },
          trx,
        );
        await this.spaceMemberService.addUserToSpace(
          user.id,
          userSpace.id,
          SpaceRole.ADMIN,
          workspace.id,
          trx,
        );
        return user;
      },
      trx,
    );

    return { user, workspace };
  }
}
