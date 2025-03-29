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
import { EnvironmentService } from '../../../integrations/environment/environment.service';
import { DomainService } from '../../../integrations/environment/domain.service';
import { jsonArrayFrom } from 'kysely/helpers/postgres';
import { addDays } from 'date-fns';
import { DISALLOWED_HOSTNAMES, WorkspaceStatus } from '../workspace.constants';

@Injectable()
export class WorkspaceService {
  constructor(
    private workspaceRepo: WorkspaceRepo,
    private spaceService: SpaceService,
    private spaceMemberService: SpaceMemberService,
    private groupRepo: GroupRepo,
    private groupUserRepo: GroupUserRepo,
    private userRepo: UserRepo,
    private environmentService: EnvironmentService,
    private domainService: DomainService,
    @InjectKysely() private readonly db: KyselyDB,
  ) {}

  async findById(workspaceId: string) {
    return this.workspaceRepo.findById(workspaceId);
  }

  async getWorkspaceInfo(workspaceId: string) {
    const workspace = await this.workspaceRepo.findById(workspaceId);
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    return workspace;
  }

  async getWorkspacePublicData(workspaceId: string) {
    const workspace = await this.db
      .selectFrom('workspaces')
      .select(['id', 'name', 'logo', 'hostname', 'enforceSso', 'licenseKey'])
      .select((eb) =>
        jsonArrayFrom(
          eb
            .selectFrom('authProviders')
            .select([
              'authProviders.id',
              'authProviders.name',
              'authProviders.type',
            ])
            .where('authProviders.isEnabled', '=', true)
            .where('workspaceId', '=', workspaceId),
        ).as('authProviders'),
      )
      .where('id', '=', workspaceId)
      .executeTakeFirst();

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const { licenseKey, ...rest } = workspace;

    return {
      ...rest,
      hasLicenseKey: Boolean(licenseKey),
    };
  }

  async create(
    user: User,
    createWorkspaceDto: CreateWorkspaceDto,
    trx?: KyselyTransaction,
  ) {
    return await executeTx(
      this.db,
      async (trx) => {
        let hostname = undefined;
        let trialEndAt = undefined;
        let status = undefined;
        let plan = undefined;

        if (this.environmentService.isCloud()) {
          // generate unique hostname
          hostname = await this.generateHostname(
            createWorkspaceDto.hostname ?? createWorkspaceDto.name,
          );
          trialEndAt = addDays(
            new Date(),
            this.environmentService.getBillingTrialDays(),
          );
          status = WorkspaceStatus.Active;
          plan = 'standard';
        }

        // create workspace
        const workspace = await this.workspaceRepo.insertWorkspace(
          {
            name: createWorkspaceDto.name,
            description: createWorkspaceDto.description,
            hostname,
            status,
            trialEndAt,
            plan,
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
          .where('users.id', '=', user.id)
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
    if (updateWorkspaceDto.enforceSso) {
      const sso = await this.db
        .selectFrom('authProviders')
        .selectAll()
        .where('isEnabled', '=', true)
        .where('workspaceId', '=', workspaceId)
        .execute();

      if (sso && sso?.length === 0) {
        throw new BadRequestException(
          'There must be at least one active SSO provider to enforce SSO.',
        );
      }
    }

    if (updateWorkspaceDto.emailDomains) {
      const regex =
        /(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]/;

      const emailDomains = updateWorkspaceDto.emailDomains || [];

      updateWorkspaceDto.emailDomains = emailDomains
        .map((domain) => regex.exec(domain)?.[0])
        .filter(Boolean);
    }

    if (updateWorkspaceDto.hostname) {
      const hostname = updateWorkspaceDto.hostname;
      if (DISALLOWED_HOSTNAMES.includes(hostname)) {
        throw new BadRequestException('Hostname already exists.');
      }
      if (await this.workspaceRepo.hostnameExists(hostname)) {
        throw new BadRequestException('Hostname already exists.');
      }
    }

    await this.workspaceRepo.updateWorkspace(updateWorkspaceDto, workspaceId);

    const workspace = await this.workspaceRepo.findById(workspaceId, {
      withMemberCount: true,
      withLicenseKey: true,
    });

    const { licenseKey, ...rest } = workspace;
    return {
      ...rest,
      hasLicenseKey: Boolean(licenseKey),
    };
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

  async generateHostname(
    name: string,
    trx?: KyselyTransaction,
  ): Promise<string> {
    const generateRandomSuffix = (length: number) =>
      Math.random()
        .toFixed(length)
        .substring(2, 2 + length);

    let subdomain = name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .substring(0, 20);
    // Ensure we leave room for a random suffix.
    const maxSuffixLength = 3;

    if (subdomain.length < 4) {
      subdomain = `${subdomain}-${generateRandomSuffix(maxSuffixLength)}`;
    }

    if (DISALLOWED_HOSTNAMES.includes(subdomain)) {
      subdomain = `myworkspace-${generateRandomSuffix(maxSuffixLength)}`;
    }

    let uniqueHostname = subdomain;

    while (true) {
      const exists = await this.workspaceRepo.hostnameExists(
        uniqueHostname,
        trx,
      );
      if (!exists) {
        break;
      }
      // Append a random suffix and retry.
      const randomSuffix = generateRandomSuffix(maxSuffixLength);
      uniqueHostname = `${subdomain}-${randomSuffix}`.substring(0, 25);
    }

    return uniqueHostname;
  }

  async checkHostname(hostname: string) {
    const exists = await this.workspaceRepo.hostnameExists(hostname);
    if (!exists) {
      throw new NotFoundException('Hostname not found');
    }
    return { hostname: this.domainService.getUrl(hostname) };
  }
}
