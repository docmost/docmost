import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { CreateUserDto } from '../dto/create-user.dto';
import { WorkspaceService } from '../../workspace/services/workspace.service';
import { CreateWorkspaceDto } from '../../workspace/dto/create-workspace.dto';
import { CreateAdminUserDto } from '../dto/create-admin-user.dto';
import { UserRepo } from '@docmost/db/repos/user/user.repo';
import { WorkspaceRepo } from '@docmost/db/repos/workspace/workspace.repo';
import { getWorkspaceDefaultPageEditMode } from '../../workspace/workspace.util';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { executeTx } from '@docmost/db/utils';
import { InjectKysely } from 'nestjs-kysely';
import { InsertableUser, User, Workspace } from '@docmost/db/types/entity.types';
import { GroupUserRepo } from '@docmost/db/repos/group/group-user.repo';
import { UserRole } from '../../../common/helpers/types/permission';
import { AuditEvent, AuditResource } from '../../../common/events/audit-events';
import {
  AUDIT_SERVICE,
  IAuditService,
} from '../../../integrations/audit/audit.service';

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
      (trx) =>
        this.createWorkspaceMember(
          { ...createUserDto, workspaceId },
          workspaceId,
          trx,
        ),
      trx,
    );

    this.logUserCreated(user, 'signup');

    return user;
  }

  async signupLdapUser(
    identity: { email: string; name?: string },
    workspaceId: string,
    trx: KyselyTransaction,
  ): Promise<User> {
    const existingUser = await this.userRepo.findByEmail(
      identity.email,
      workspaceId,
      { trx },
    );
    if (existingUser) {
      throw new BadRequestException(
        'An account with this email already exists in this workspace',
      );
    }

    return this.createWorkspaceMember(
      {
        email: identity.email,
        name: identity.name,
        password: null,
        emailVerifiedAt: new Date(),
        role: UserRole.MEMBER,
        workspaceId,
      },
      workspaceId,
      trx,
      UserRole.MEMBER,
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

  private async createWorkspaceMember(
    insertableUser: InsertableUser,
    workspaceId: string,
    trx: KyselyTransaction,
    assignedRole?: UserRole,
  ): Promise<User> {
    const workspace = await this.workspaceRepo.findById(workspaceId, { trx });
    const user = await this.userRepo.insertUser(
      insertableUser,
      trx,
      { pageEditMode: getWorkspaceDefaultPageEditMode(workspace) },
    );

    await this.workspaceService.addUserToWorkspace(
      user.id,
      workspaceId,
      assignedRole,
      trx,
    );
    await this.groupUserRepo.addUserToDefaultGroup(user.id, workspaceId, trx);
    return user;
  }

  private logUserCreated(user: User, source: 'signup' | 'ldap'): void {
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
      metadata: { source },
    });
  }
}
