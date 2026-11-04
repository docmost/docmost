import { ForbiddenException } from '@nestjs/common';
import { PageAccessService } from './page-access.service';

function makeService(workspaceSettings: any, spaceSettings: any) {
  const spaceRepo = {
    findById: jest.fn().mockResolvedValue({ settings: spaceSettings }),
  };
  const workspaceRepo = {
    findById: jest.fn().mockResolvedValue({ settings: workspaceSettings }),
  };
  const service = new PageAccessService(
    {} as any,
    {} as any,
    spaceRepo as any,
    workspaceRepo as any,
  );

  return { service, spaceRepo, workspaceRepo };
}

describe('PageAccessService validateCanExport', () => {
  it('allows export when neither level disables it', async () => {
    const { service, spaceRepo, workspaceRepo } = makeService({}, null);

    await expect(
      service.validateCanExport('space-1', 'ws-1'),
    ).resolves.toBeUndefined();

    expect(spaceRepo.findById).toHaveBeenCalledWith('space-1', 'ws-1');
    expect(workspaceRepo.findById).toHaveBeenCalledWith('ws-1');
  });

  it('rejects with the workspace message when the workspace disables export', async () => {
    const { service } = makeService({ export: { disabled: true } }, {});

    const error = await service
      .validateCanExport('space-1', 'ws-1')
      .catch((e) => e);

    expect(error).toBeInstanceOf(ForbiddenException);
    expect(error.message).toBe('Export is disabled in this workspace');
  });

  it('prefers the workspace message when both levels disable export', async () => {
    const { service } = makeService(
      { export: { disabled: true } },
      { export: { disabled: true } },
    );

    const error = await service
      .validateCanExport('space-1', 'ws-1')
      .catch((e) => e);

    expect(error).toBeInstanceOf(ForbiddenException);
    expect(error.message).toBe('Export is disabled in this workspace');
  });

  it('rejects with the space message when only the space disables export', async () => {
    const { service } = makeService({}, { export: { disabled: true } });

    const error = await service
      .validateCanExport('space-1', 'ws-1')
      .catch((e) => e);

    expect(error).toBeInstanceOf(ForbiddenException);
    expect(error.message).toBe('Export is disabled in this space');
  });
});
