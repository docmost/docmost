import { ForbiddenException } from '@nestjs/common';
import { PageAccessService } from './page-access.service';

function makeService(settings: any) {
  const spaceRepo = {
    findSettingsWithWorkspace: jest.fn().mockResolvedValue(settings),
  };
  const service = new PageAccessService({} as any, {} as any, spaceRepo as any);

  return { service, spaceRepo };
}

describe('PageAccessService validateCanExport', () => {
  it('allows export when neither level disables it', async () => {
    const { service, spaceRepo } = makeService({
      workspaceSettings: {},
      spaceSettings: null,
    });

    await expect(
      service.validateCanExport('space-1', 'ws-1'),
    ).resolves.toBeUndefined();

    expect(spaceRepo.findSettingsWithWorkspace).toHaveBeenCalledWith(
      'space-1',
      'ws-1',
    );
  });

  it('rejects with the workspace message when the workspace disables export', async () => {
    const { service } = makeService({
      workspaceSettings: { export: { disabled: true } },
      spaceSettings: {},
    });

    const error = await service
      .validateCanExport('space-1', 'ws-1')
      .catch((e) => e);

    expect(error).toBeInstanceOf(ForbiddenException);
    expect(error.message).toBe('Export is disabled in this workspace');
  });

  it('prefers the workspace message when both levels disable export', async () => {
    const { service } = makeService({
      workspaceSettings: { export: { disabled: true } },
      spaceSettings: { export: { disabled: true } },
    });

    const error = await service
      .validateCanExport('space-1', 'ws-1')
      .catch((e) => e);

    expect(error).toBeInstanceOf(ForbiddenException);
    expect(error.message).toBe('Export is disabled in this workspace');
  });

  it('rejects with the space message when only the space disables export', async () => {
    const { service } = makeService({
      workspaceSettings: {},
      spaceSettings: { export: { disabled: true } },
    });

    const error = await service
      .validateCanExport('space-1', 'ws-1')
      .catch((e) => e);

    expect(error).toBeInstanceOf(ForbiddenException);
    expect(error.message).toBe('Export is disabled in this space');
  });

  it('rejects when the space is not in the workspace', async () => {
    const { service } = makeService(undefined);

    await expect(
      service.validateCanExport('space-1', 'ws-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
