import { BadRequestException } from '@nestjs/common';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { User } from '@docmost/db/types/entity.types';
import { GroupUserRepo } from '../../../database/repos/group/group-user.repo';
import { UserRepo } from '../../../database/repos/user/user.repo';
import { WorkspaceRepo } from '../../../database/repos/workspace/workspace.repo';
import { WorkspaceService } from '../../workspace/services/workspace.service';
import { UserRole } from '../../../common/helpers/types/permission';
import { IAuditService } from '../../../integrations/audit/audit.service';
import { SignupService } from './signup.service';

describe('SignupService.signupLdapUser', () => {
  const transaction = {} as KyselyTransaction;
  const user = {
    id: 'user-1',
    email: 'alice@example.com',
    name: 'Alice Example',
    role: UserRole.MEMBER,
  } as User;
  const userRepo = {
    findByEmail: jest.fn(),
    insertUser: jest.fn(),
  };
  const workspaceRepo = {
    findById: jest.fn(),
  };
  const workspaceService = {
    addUserToWorkspace: jest.fn(),
  };
  const groupUserRepo = {
    addUserToDefaultGroup: jest.fn(),
  };
  const auditService = {
    log: jest.fn(),
  };
  let service: SignupService;

  beforeEach(() => {
    jest.clearAllMocks();
    userRepo.findByEmail.mockResolvedValue(undefined);
    userRepo.insertUser.mockResolvedValue(user);
    workspaceRepo.findById.mockResolvedValue({
      id: 'workspace-1',
      settings: { defaultPageEditMode: 'read' },
    });
    workspaceService.addUserToWorkspace.mockResolvedValue(undefined);
    groupUserRepo.addUserToDefaultGroup.mockResolvedValue(undefined);

    service = new SignupService(
      userRepo as unknown as UserRepo,
      workspaceRepo as unknown as WorkspaceRepo,
      workspaceService as unknown as WorkspaceService,
      groupUserRepo as unknown as GroupUserRepo,
      {} as KyselyDB,
      auditService as unknown as IAuditService,
    );
  });

  it('creates a verified passwordless member and completes standard workspace signup', async () => {
    await expect(
      service.signupLdapUser(
        { email: 'alice@example.com', name: 'Alice Example' },
        'workspace-1',
        transaction,
      ),
    ).resolves.toBe(user);

    expect(userRepo.insertUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'alice@example.com',
        name: 'Alice Example',
        password: null,
        emailVerifiedAt: expect.any(Date),
        role: UserRole.MEMBER,
        workspaceId: 'workspace-1',
      }),
      transaction,
      { pageEditMode: 'read' },
    );
    expect(workspaceService.addUserToWorkspace).toHaveBeenCalledWith(
      user.id,
      'workspace-1',
      UserRole.MEMBER,
      transaction,
    );
    expect(groupUserRepo.addUserToDefaultGroup).toHaveBeenCalledWith(
      user.id,
      'workspace-1',
      transaction,
    );
    expect(auditService.log).not.toHaveBeenCalled();
  });

  it('rejects an existing local email without linking or inserting a user', async () => {
    userRepo.findByEmail.mockResolvedValue(user);

    await expect(
      service.signupLdapUser(
        { email: 'alice@example.com' },
        'workspace-1',
        transaction,
      ),
    ).rejects.toThrow(BadRequestException);

    expect(userRepo.insertUser).not.toHaveBeenCalled();
    expect(auditService.log).not.toHaveBeenCalled();
  });
});