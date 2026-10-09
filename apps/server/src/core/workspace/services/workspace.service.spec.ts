import { BadRequestException } from '@nestjs/common';
import { WorkspaceService } from './workspace.service';
import { UpdateWorkspaceDto } from '../dto/update-workspace.dto';

// Exercise the update flow with persistence isolated from external services.
function makeService() {
  let workspace = { id: 'workspace-id', emailDomains: ['old.example.com'] };
  const workspaceRepo = {
    findById: jest.fn(async () => workspace),
    updateWorkspace: jest.fn(async (update: Partial<typeof workspace>) => {
      workspace = { ...workspace, ...update };
    }),
  };
  const service = Object.assign(Object.create(WorkspaceService.prototype), {
    workspaceRepo,
    environmentService: { isBetaPublicSpaces: () => false },
    db: { transaction: () => ({ execute: (callback) => callback({}) }) },
    auditService: { log: jest.fn() },
  }) as WorkspaceService;
  return { service, workspaceRepo };
}

describe('WorkspaceService allowed email domains', () => {
  it.each([
    ['Example.com', 'example.com'],
    ['ACME.COM', 'acme.com'],
    ['example.COM', 'example.com'],
    ['mail.Example.org', 'mail.example.org'],
    ['  Acme.io  ', 'acme.io'],
    ['my-team.example.com', 'my-team.example.com'],
  ])('saves %s as %s without truncating labels', async (input, expected) => {
    const { service, workspaceRepo } = makeService();
    const result = await service.update('workspace-id', {
      emailDomains: [input],
    } as UpdateWorkspaceDto);
    expect(result.emailDomains).toEqual([expected]);
    expect(workspaceRepo.updateWorkspace).toHaveBeenCalledWith(
      { emailDomains: [expected] },
      'workspace-id',
      expect.anything(),
    );
  });

  it.each([
    'https://example.com',
    'user@example.com',
    'example.com/path',
    '-example.com',
    'example-.com',
    'example..com',
    'not a domain',
    '',
    null,
    42,
  ])(
    'rejects invalid entry %s before changing persisted restrictions',
    async (input) => {
      const { service, workspaceRepo } = makeService();
      await expect(
        service.update('workspace-id', {
          emailDomains: ['valid.example.com', input],
        } as UpdateWorkspaceDto),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(workspaceRepo.updateWorkspace).not.toHaveBeenCalled();
    },
  );

  it('allows an explicit empty list to remove restrictions', async () => {
    const { service } = makeService();
    const result = await service.update('workspace-id', {
      emailDomains: [],
    } as UpdateWorkspaceDto);
    expect(result.emailDomains).toEqual([]);
  });

  it('does not change restrictions when the field is omitted', async () => {
    const { service } = makeService();
    const result = await service.update(
      'workspace-id',
      {} as UpdateWorkspaceDto,
    );
    expect(result.emailDomains).toEqual(['old.example.com']);
  });
});
