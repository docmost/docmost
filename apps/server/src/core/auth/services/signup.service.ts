import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { CreateUserDto } from '../dto/create-user.dto.js';
import { WorkspaceService } from '../../workspace/services/workspace.service.js';
import { CreateWorkspaceDto } from '../../workspace/dto/create-workspace.dto.js';
import { CreateAdminUserDto } from '../dto/create-admin-user.dto.js';
import { UserRepo } from '@docmost/db/repos/user/user.repo.js';
import { WorkspaceRepo } from '@docmost/db/repos/workspace/workspace.repo.js';
import { getWorkspaceDefaultPageEditMode } from '../../workspace/workspace.util.js';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types.js';
import { executeTx } from '@docmost/db/utils.js';
import { InjectKysely } from 'nestjs-kysely';
import { User, Workspace } from '@docmost/db/types/entity.types.js';
import { GroupUserRepo } from '@docmost/db/repos/group/group-user.repo.js';
import { UserRole } from '../../../common/helpers/types/permission.js';
import { AuditEvent, AuditResource } from '../../../common/events/audit-events.js';
import {
  AUDIT_SERVICE,
  IAuditService,
} from '../../../integrations/audit/audit.service.js';

@Injectable()
export class SignupService {
  constructor(
    private userRepo: UserRepo,
    private workspaceRepo: WorkspaceRepo,
    private workspaceService: WorkspaceService,
    private groupUserRepo: GroupUserRepo,
    @InjectKysely() private readonly db: KyselyDB,
    @Inject(AUDIT_SERVICE) private readonly auditService: IAuditService,
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

    const user = await executeTx(
      this.db,
      async (trx) => {
        // create user
        const workspace = await this.workspaceRepo.findById(workspaceId, {
          trx,
        });
        const user = await this.userRepo.insertUser(
          {
            ...createUserDto,
            workspaceId: workspaceId,
          },
          trx,
          { pageEditMode: getWorkspaceDefaultPageEditMode(workspace) },
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
        return user;
      },
      trx,
    );

    this.auditService.log({
      event: AuditEvent.USER_CREATED,
      resourceType: AuditResource.USER,
      resourceId: user.id,
      changes: {
        after: {
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
      metadata: {
        source: 'signup',
      },
    });

    return user;
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
          name: createAdminUserDto.workspaceName || 'My workspace',
          hostname: createAdminUserDto.hostname,
        };

        workspace = await this.workspaceService.create(
          user,
          workspaceData,
          trx,
        );

        user.workspaceId = workspace.id;
        return user;
      },
      trx,
    );

    return { user, workspace };
  }
}
