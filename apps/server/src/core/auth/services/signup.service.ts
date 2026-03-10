import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateWorkspaceDto } from '../../workspace/dto/create-workspace.dto';
import { CreateAdminUserDto } from '../dto/create-admin-user.dto';
import { UserRepo } from '@docmost/db/repos/user/user.repo';
import { WorkspaceRepo } from '@docmost/db/repos/workspace/workspace.repo';
import { GroupRepo } from '@docmost/db/repos/group/group.repo';
import { SpaceService } from '../../space/services/space.service';
import { SpaceMemberService } from '../../space/services/space-member.service';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { executeTx } from '@docmost/db/utils';
import { InjectKysely } from 'nestjs-kysely';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { GroupUserRepo } from '@docmost/db/repos/group/group-user.repo';
import { UserRole, SpaceRole } from '../../../common/helpers/types/permission';
import { EnvironmentService } from '../../../integrations/environment/environment.service';
import { CreateSpaceDto } from '../../space/dto/create-space.dto';

@Injectable()
export class SignupService {
  constructor(
    private userRepo: UserRepo,
    private workspaceRepo: WorkspaceRepo,
    private groupRepo: GroupRepo,
    private groupUserRepo: GroupUserRepo,
    private spaceService: SpaceService,
    private spaceMemberService: SpaceMemberService,
    private environmentService: EnvironmentService,
    @InjectKysely() private readonly db: KyselyDB,
  ) {}

  private validateEmailDomain(email: string): void {
    const allowedDomains = this.environmentService.getEmailAllowedDomains();
    if (allowedDomains.length > 0) {
      const emailDomain = email.split('@')[1];
      if (!allowedDomains.includes(emailDomain)) {
        throw new BadRequestException(
          'Your email domain is not allowed to register. Please contact your administrator.',
        );
      }
    }
  }

  async initialSetup(
    createAdminUserDto: CreateAdminUserDto,
    trx?: KyselyTransaction,
  ) {
    this.validateEmailDomain(createAdminUserDto.email);

    let user: User,
      workspace: Workspace = null;

    await executeTx(
      this.db,
      async (trx) => {
        const workspaceData: CreateWorkspaceDto = {
          name: createAdminUserDto.workspaceName || 'My workspace',
          hostname: createAdminUserDto.hostname,
        };

        workspace = await this.workspaceRepo.insertWorkspace(
          {
            name: workspaceData.name,
            hostname: workspaceData.hostname,
          },
          trx,
        );

        user = await this.userRepo.insertUser(
          {
            name: createAdminUserDto.name,
            email: createAdminUserDto.email,
            password: createAdminUserDto.password,
            role: UserRole.OWNER,
            workspaceId: workspace.id,
            emailVerifiedAt: new Date(),
          },
          trx,
        );

        const group = await this.groupRepo.createDefaultGroup(workspace.id, {
          userId: user.id,
          trx: trx,
        });

        await this.groupUserRepo.insertGroupUser(
          {
            userId: user.id,
            groupId: group.id,
          },
          trx,
        );

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

        await this.spaceMemberService.addUserToSpace(
          user.id,
          createdSpace.id,
          SpaceRole.ADMIN,
          workspace.id,
          trx,
        );

        await this.spaceMemberService.addGroupToSpace(
          group.id,
          createdSpace.id,
          SpaceRole.WRITER,
          workspace.id,
          trx,
        );

        await this.workspaceRepo.updateWorkspace(
          {
            defaultSpaceId: createdSpace.id,
          },
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
