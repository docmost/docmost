import { BadRequestException } from '@nestjs/common';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { User } from '@docmost/db/types/entity.types';
import { LdapIdentityRepo } from '../../../database/repos/ldap-identity/ldap-identity.repo';
import { UserRepo } from '../../../database/repos/user/user.repo';
import { LdapAuthenticatedIdentity } from './ldap-auth.service';
import { LdapProvisioningService } from './ldap-provisioning.service';
import { SignupService } from './signup.service';

const mockTransaction = {};
const mockExecuteTx = jest.fn((_db, callback) => callback(mockTransaction));

jest.mock('@docmost/db/utils', () => ({
  executeTx: (...args) => mockExecuteTx(...args),
}));

const identity: LdapAuthenticatedIdentity = {
  subjectId: 'directory-id-1',
  email: 'alice@example.com',
  name: 'Alice Example',
};

const createdUser = {
  id: 'user-1',
  workspaceId: 'workspace-1',
  role: 'member',
  deactivatedAt: null,
  deletedAt: null,
} as User;

describe('LdapProvisioningService', () => {
  const ldapIdentityRepo = {
    findBySubjectId: jest.fn(),
    insertIdentity: jest.fn(),
    lockForProvisioning: jest.fn(),
  };
  const userRepo = {
    findById: jest.fn(),
  };
  const signupService = {
    signupLdapUser: jest.fn(),
  };
  const auditService = {
    log: jest.fn(),
  };
  let service: LdapProvisioningService;

  beforeEach(() => {
    jest.clearAllMocks();
    ldapIdentityRepo.findBySubjectId.mockResolvedValue(undefined);
    ldapIdentityRepo.insertIdentity.mockResolvedValue(undefined);
    ldapIdentityRepo.lockForProvisioning.mockResolvedValue(undefined);
    userRepo.findById.mockResolvedValue(createdUser);
    signupService.signupLdapUser.mockResolvedValue(createdUser);

    service = new LdapProvisioningService(
      {} as KyselyDB,
      ldapIdentityRepo as unknown as LdapIdentityRepo,
      userRepo as unknown as UserRepo,
      signupService as unknown as SignupService,
      auditService as never,
    );
  });

  it('creates and links a member atomically for a new directory subject', async () => {
    await expect(
      service.findOrProvisionMember(identity, 'workspace-1'),
    ).resolves.toBe(createdUser);

    expect(ldapIdentityRepo.lockForProvisioning).toHaveBeenCalledWith(
      'workspace-1',
      identity.subjectId,
      identity.email,
      mockTransaction,
    );
    expect(signupService.signupLdapUser).toHaveBeenCalledWith(
      identity,
      'workspace-1',
      mockTransaction,
    );
    expect(ldapIdentityRepo.insertIdentity).toHaveBeenCalledWith(
      {
        workspaceId: 'workspace-1',
        userId: createdUser.id,
        subjectId: identity.subjectId,
      },
      mockTransaction,
    );
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceId: createdUser.id,
        metadata: { source: 'ldap' },
      }),
    );
  });

  it('returns the linked user on subsequent logins', async () => {
    ldapIdentityRepo.findBySubjectId.mockResolvedValue({
      userId: createdUser.id,
      workspaceId: 'workspace-1',
      subjectId: identity.subjectId,
    });

    await expect(
      service.findOrProvisionMember(identity, 'workspace-1'),
    ).resolves.toBe(createdUser);

    expect(userRepo.findById).toHaveBeenCalledWith(createdUser.id, 'workspace-1', {
      trx: mockTransaction,
    });
    expect(signupService.signupLdapUser).not.toHaveBeenCalled();
    expect(ldapIdentityRepo.insertIdentity).not.toHaveBeenCalled();
    expect(auditService.log).not.toHaveBeenCalled();
  });

  it('does not link an identity to a disabled or missing workspace user', async () => {
    ldapIdentityRepo.findBySubjectId.mockResolvedValue({
      userId: createdUser.id,
      workspaceId: 'workspace-1',
      subjectId: identity.subjectId,
    });
    userRepo.findById.mockResolvedValue({ ...createdUser, deactivatedAt: new Date() });

    await expect(
      service.findOrProvisionMember(identity, 'workspace-1'),
    ).rejects.toThrow('LDAP account is unavailable');
    expect(signupService.signupLdapUser).not.toHaveBeenCalled();
  });

  it('rejects existing unlinked accounts instead of auto-linking by email', async () => {
    signupService.signupLdapUser.mockRejectedValue(
      new BadRequestException('An account with this email already exists'),
    );

    await expect(
      service.findOrProvisionMember(identity, 'workspace-1'),
    ).rejects.toThrow('An account with this email already exists');
    expect(ldapIdentityRepo.insertIdentity).not.toHaveBeenCalled();
    expect(auditService.log).not.toHaveBeenCalled();
  });

  it('scopes the same directory subject independently to each workspace', async () => {
    await service.findOrProvisionMember(identity, 'workspace-2');

    expect(ldapIdentityRepo.findBySubjectId).toHaveBeenCalledWith(
      'workspace-2',
      identity.subjectId,
      mockTransaction,
    );
    expect(ldapIdentityRepo.insertIdentity).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: 'workspace-2' }),
      mockTransaction,
    );
  });
});