import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { KYSELY_MODULE_CONNECTION_TOKEN } from 'nestjs-kysely';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { Page, User } from '@docmost/db/types/entity.types';
import { QueueName } from '../../../integrations/queue/constants';
import { PageVerificationInvalidationService } from '../verification/page-verification-invalidation.service';
import { PageService } from './page.service';

describe('PageService', () => {
  let service: PageService;
  const pageRepo = { findById: jest.fn(), updatePage: jest.fn() };
  const watchers = { add: jest.fn().mockResolvedValue(undefined) };
  const verification = { invalidateForEdit: jest.fn().mockResolvedValue(null) };
  const trx = {};
  const db = { transaction: () => ({ execute: (fn) => fn(trx) }) };
  const writer = { id: 'writer' } as User;
  const stored = {
    id: 'page',
    title: 'Roadmap',
    icon: null,
    updatedAt: new Date('2026-01-01'),
    lastUpdatedById: 'previous-writer',
    contributorIds: ['previous-writer'],
  } as Page;

  beforeEach(async () => {
    jest.clearAllMocks();
    pageRepo.findById.mockResolvedValue(stored);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PageService,
        { provide: PageRepo, useValue: pageRepo },
        { provide: KYSELY_MODULE_CONNECTION_TOKEN(), useValue: db },
        { provide: getQueueToken(QueueName.GENERAL_QUEUE), useValue: watchers },
        {
          provide: PageVerificationInvalidationService,
          useValue: verification,
        },
      ],
    })
      .useMocker(() => ({}))
      .compile();

    service = module.get<PageService>(PageService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('leaves edit metadata alone when another request already saved the title', async () => {
    const stale = { ...stored, title: 'Earlier title' };
    const result = await service.update(
      stale,
      { pageId: stored.id, title: stored.title },
      writer,
    );

    expect(pageRepo.findById).toHaveBeenCalledWith(stored.id, {
      withLock: true,
      trx,
    });
    expect(pageRepo.updatePage).not.toHaveBeenCalled();
    expect(verification.invalidateForEdit).not.toHaveBeenCalled();
    expect(watchers.add).not.toHaveBeenCalled();
    expect(result).toMatchObject(stored);
  });

  it.each([
    ['Release notes', ' Release  notes '],
    [null, ''],
  ])(
    'preserves edit metadata when the literal title changes from %p to %p',
    async (previous, title) => {
      const page = { ...stored, title: previous };
      pageRepo.findById.mockResolvedValue(page);

      await service.update(page, { pageId: page.id, title }, writer);

      expect(pageRepo.updatePage.mock.calls).toStrictEqual([
        [{ title, updatedAt: undefined }, page.id, trx],
      ]);
      expect(verification.invalidateForEdit).not.toHaveBeenCalled();
      expect(watchers.add).not.toHaveBeenCalled();
    },
  );

  it('credits changing a title back using the latest title and contributors', async () => {
    const stale = { ...stored, title: 'Earlier title', contributorIds: [] };
    await service.update(
      stale,
      { pageId: stored.id, title: stale.title },
      writer,
    );

    expect(pageRepo.updatePage).toHaveBeenCalledWith(
      expect.objectContaining({
        title: stale.title,
        lastUpdatedById: writer.id,
        contributorIds: ['previous-writer', writer.id],
      }),
      stored.id,
      trx,
    );
    expect(verification.invalidateForEdit).toHaveBeenCalledTimes(1);
    const [verificationInput] = verification.invalidateForEdit.mock.calls[0];
    expect(await verificationInput.loadPreviousState()).toMatchObject(stored);
    expect(watchers.add).toHaveBeenCalledTimes(1);
  });

  it('credits a changed icon submitted alongside the existing title', async () => {
    await service.update(
      stored,
      { pageId: stored.id, title: stored.title, icon: '📌' },
      writer,
    );

    expect(pageRepo.updatePage).toHaveBeenCalledWith(
      expect.objectContaining({
        icon: '📌',
        lastUpdatedById: writer.id,
        contributorIds: ['previous-writer', writer.id],
      }),
      stored.id,
      trx,
    );
    expect(verification.invalidateForEdit).not.toHaveBeenCalled();
  });

  it('leaves credit for a body edit to the body save when the title matches', async () => {
    const updateBody = jest
      .spyOn(service, 'updatePageContent')
      .mockResolvedValue(undefined);
    const content = 'A new paragraph';
    await service.update(
      stored,
      {
        pageId: stored.id,
        title: stored.title,
        content,
        operation: 'append',
        format: 'markdown',
      },
      writer,
    );

    expect(updateBody).toHaveBeenCalledWith(
      stored.id,
      content,
      'append',
      'markdown',
      writer,
    );
    expect(pageRepo.updatePage).not.toHaveBeenCalled();
    expect(verification.invalidateForEdit).not.toHaveBeenCalled();
  });
});
