import { SpaceService } from './space.service';

describe('SpaceService deleteSpace', () => {
  it('rechecks access for viewers of the deleted space', async () => {
    const spaceRepo = {
      findById: jest.fn().mockResolvedValue({ id: 'space-1' }),
      deleteSpace: jest.fn(),
    };
    const ws = { notifyAccessChanged: jest.fn() };
    const service = new SpaceService(
      spaceRepo as any,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      { add: jest.fn() } as any,
      { log: jest.fn() } as any,
      ws as any,
      undefined,
      undefined,
    );
    await service.deleteSpace('space-1', 'workspace-1');
    expect(spaceRepo.deleteSpace).toHaveBeenCalledWith(
      'space-1',
      'workspace-1',
    );
    expect(ws.notifyAccessChanged).toHaveBeenCalledWith([], ['space-1']);
  });
});

describe('SpaceService updateSpace', () => {
  it('ignores a null disableExport', async () => {
    const spaceRepo = {
      findById: jest.fn().mockResolvedValue({
        id: 'space-1',
        settings: { export: { disabled: true } },
      }),
      updateExportSettings: jest.fn(),
      updateSpace: jest.fn().mockResolvedValue({ id: 'space-1' }),
    };
    const auditService = { log: jest.fn() };
    const db = { transaction: () => ({ execute: (fn: any) => fn({}) }) };
    const service = new SpaceService(
      spaceRepo as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      db as any,
      {} as any,
      auditService as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await service.updateSpace(
      { spaceId: 'space-1', disableExport: null } as any,
      'ws-1',
    );

    expect(spaceRepo.updateExportSettings).not.toHaveBeenCalled();
    expect(auditService.log).not.toHaveBeenCalled();
  });
});
