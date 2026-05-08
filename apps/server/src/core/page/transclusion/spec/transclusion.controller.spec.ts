import { Test } from '@nestjs/testing';
import { TransclusionController } from '../transclusion.controller';
import { TransclusionService } from '../transclusion.service';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';

describe('TransclusionController.lookup', () => {
  let controller: TransclusionController;
  let service: jest.Mocked<TransclusionService>;

  beforeEach(async () => {
    service = {
      lookup: jest.fn(),
      listReferences: jest.fn(),
      unsyncReference: jest.fn(),
    } as any;

    const module = await Test.createTestingModule({
      controllers: [TransclusionController],
      providers: [{ provide: TransclusionService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(TransclusionController);
  });

  const user = { id: 'u1', workspaceId: 'w1' } as any;
  const ref = { sourcePageId: 'p1', transclusionId: 'e1' };

  it('passes the references, viewer id and workspace id through to the service and returns its result', async () => {
    service.lookup.mockResolvedValue({
      items: [
        {
          sourcePageId: 'p1',
          transclusionId: 'e1',
          content: { type: 'doc' },
          sourceUpdatedAt: new Date(),
        },
      ],
    } as any);

    const out = await controller.lookup({ references: [ref] } as any, user);
    expect(out.items[0]).not.toHaveProperty('status');
    expect((out.items[0] as any).content).toEqual({ type: 'doc' });
    expect(service.lookup).toHaveBeenCalledWith([ref], 'u1', 'w1');
  });
});
