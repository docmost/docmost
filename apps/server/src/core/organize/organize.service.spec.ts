import { NotFoundException } from '@nestjs/common';
import { OrganizeService } from './organize.service';

describe('OrganizeService', () => {
  let service: OrganizeService;
  let organizeRepo: any;
  let environmentService: any;

  const workspaceId = 'ws-1';
  const user = { id: 'user-1', workspaceId } as any;

  beforeEach(() => {
    organizeRepo = {
      insert: jest.fn(),
      update: jest.fn(),
      findById: jest.fn(),
      findByShareToken: jest.fn(),
      insertEvent: jest.fn(),
      findEvents: jest.fn().mockResolvedValue([]),
      getTasksPaginated: jest.fn(),
    };
    environmentService = {
      getAppUrl: jest.fn().mockReturnValue('https://wiki.example.com'),
    };
    service = new OrganizeService(organizeRepo, environmentService);
  });

  describe('create', () => {
    it('generates a 32-char share token and returns a status URL', async () => {
      organizeRepo.insert.mockImplementation(async (v: any) => ({
        id: 'task-1',
        completed: 0,
        status: 'open',
        ...v,
      }));

      const result = await service.create(user, workspaceId, {
        spaceId: 'space-1',
        source: 'upload',
      });

      const inserted = organizeRepo.insert.mock.calls[0][0];
      expect(inserted.workspaceId).toBe(workspaceId);
      expect(inserted.creatorId).toBe(user.id);
      expect(inserted.source).toBe('upload');
      expect(inserted.status).toBe('open');
      expect(inserted.shareToken).toHaveLength(32);
      expect(result.statusUrl).toBe(
        `https://wiki.example.com/organize/${inserted.shareToken}`,
      );
    });

    it('defaults source to upload when omitted', async () => {
      organizeRepo.insert.mockResolvedValue({
        id: 'task-1',
        shareToken: 'tok',
        completed: 0,
      });
      await service.create(user, workspaceId, {});
      expect(organizeRepo.insert.mock.calls[0][0].source).toBe('upload');
    });
  });

  describe('getInfo', () => {
    it('returns the task with events and a status URL', async () => {
      organizeRepo.findById.mockResolvedValue({
        id: 'task-1',
        workspaceId,
        shareToken: 'tok123',
        completed: 0,
      });
      organizeRepo.findEvents.mockResolvedValue([{ id: 'ev-1', step: 'summarize' }]);

      const result = await service.getInfo('task-1', workspaceId);

      expect(result.events).toHaveLength(1);
      expect(result.statusUrl).toBe('https://wiki.example.com/organize/tok123');
    });

    it('throws NotFound for a task in another workspace', async () => {
      organizeRepo.findById.mockResolvedValue(undefined);
      await expect(service.getInfo('task-x', workspaceId)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('addEvent', () => {
    it('flips an open task to running and serializes detail', async () => {
      organizeRepo.findById.mockResolvedValue({
        id: 'task-1',
        workspaceId,
        status: 'open',
        completed: 0,
        shareToken: 'tok',
      });
      organizeRepo.insertEvent.mockResolvedValue({ id: 'ev-1' });
      organizeRepo.update.mockResolvedValue({
        id: 'task-1',
        workspaceId,
        status: 'running',
        completed: 0,
        shareToken: 'tok',
      });

      await service.addEvent(workspaceId, {
        organizeTaskId: 'task-1',
        step: 'summarize',
        detail: { ok: true },
      });

      expect(organizeRepo.insertEvent.mock.calls[0][0].detail).toBe(
        JSON.stringify({ ok: true }),
      );
      expect(organizeRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'running' }),
        'task-1',
        workspaceId,
      );
    });

    it('increments completed when the event counts as progress', async () => {
      organizeRepo.findById.mockResolvedValue({
        id: 'task-1',
        workspaceId,
        status: 'running',
        completed: 2,
        shareToken: 'tok',
      });
      organizeRepo.insertEvent.mockResolvedValue({ id: 'ev-2' });
      organizeRepo.update.mockResolvedValue({
        id: 'task-1',
        workspaceId,
        completed: 3,
        shareToken: 'tok',
      });

      await service.addEvent(workspaceId, {
        organizeTaskId: 'task-1',
        step: 'done',
        countsAsProgress: true,
      });

      expect(organizeRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ completed: 3 }),
        'task-1',
        workspaceId,
      );
    });

    it('does not touch the task for a non-progress event on a running task', async () => {
      organizeRepo.findById.mockResolvedValue({
        id: 'task-1',
        workspaceId,
        status: 'running',
        completed: 1,
        shareToken: 'tok',
      });
      organizeRepo.insertEvent.mockResolvedValue({ id: 'ev-3' });

      await service.addEvent(workspaceId, {
        organizeTaskId: 'task-1',
        step: 'info',
      });

      expect(organizeRepo.update).not.toHaveBeenCalled();
    });

    it('throws NotFound when the task is missing', async () => {
      organizeRepo.findById.mockResolvedValue(undefined);
      await expect(
        service.addEvent(workspaceId, { organizeTaskId: 'nope', step: 'x' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
