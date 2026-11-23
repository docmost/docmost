import { Test, TestingModule } from '@nestjs/testing';
import { SpaceService } from './space.service';

describe('SpaceService', () => {
  let service: SpaceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SpaceService],
    }).compile();

    service = module.get<SpaceService>(SpaceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
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
