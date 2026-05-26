import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ServicesService } from './services.service';
import { ServicesRepository } from './services.repository';
import { AuditService } from '../audit/audit.service';
import { KYSELY_MODULE_CONNECTION_TOKEN } from 'nestjs-kysely';

const mockRepo = () => ({
  findByIdOrCode: jest.fn(),
  findAll: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
  retire: jest.fn(),
  listTags: jest.fn(),
  getServiceTags: jest.fn(),
  upsertTags: jest.fn(),
  clearTags: jest.fn(),
  bulkInsert: jest.fn(),
});

const mockAudit = () => ({ log: jest.fn() });

const mockDb = () => ({
  transaction: jest.fn().mockReturnValue({
    execute: jest.fn(async (cb) => cb({})),
  }),
  fn: { countAll: jest.fn().mockReturnValue({ as: jest.fn() }) },
  selectFrom: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  executeTakeFirst: jest.fn(),
  insertInto: jest.fn().mockReturnThis(),
  values: jest.fn().mockReturnThis(),
  returningAll: jest.fn().mockReturnThis(),
  executeTakeFirstOrThrow: jest.fn(),
});

const authUser: any = {
  id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
};

const workspace: any = { id: 'ws-1', name: 'Test' };

describe('ServicesService', () => {
  let service: ServicesService;
  let repo: ReturnType<typeof mockRepo>;
  let audit: ReturnType<typeof mockAudit>;
  let db: ReturnType<typeof mockDb>;

  beforeEach(async () => {
    repo = mockRepo();
    audit = mockAudit();
    db = mockDb();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServicesService,
        { provide: ServicesRepository, useValue: repo },
        { provide: AuditService, useValue: audit },
        { provide: KYSELY_MODULE_CONNECTION_TOKEN(), useValue: db },
      ],
    }).compile();

    service = module.get<ServicesService>(ServicesService);
  });

  // ── createService ─────────────────────────────────────────────────────────

  describe('createService', () => {
    it('throws BadRequestException if code already exists', async () => {
      repo.findByIdOrCode.mockResolvedValue({ id: 'existing' });
      await expect(
        service.createService({ code: 'svc', name: 'Svc' } as any, authUser, workspace),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates service, space and root page in transaction', async () => {
      repo.findByIdOrCode.mockResolvedValue(null);

      const createdService = {
        id: 'svc-1',
        code: 'slcone',
        name: 'SLCone',
        domain: null,
        lifecycle_state: 'active',
      };

      // Mock the transaction to simulate DB inserts
      const trxMock: any = {
        insertInto: jest.fn().mockReturnThis(),
        values: jest.fn().mockReturnThis(),
        returningAll: jest.fn().mockReturnThis(),
        executeTakeFirstOrThrow: jest
          .fn()
          .mockResolvedValueOnce({ id: 'space-1' })   // space insert
          .mockResolvedValueOnce({ id: 'page-1' }),    // root page insert
      };

      db.transaction.mockReturnValue({
        execute: jest.fn(async (cb) => cb(trxMock)),
      });

      repo.insert.mockResolvedValue(createdService);
      repo.getServiceTags.mockResolvedValue([]);

      const result = await service.createService(
        { code: 'slcone', name: 'SLCone' } as any,
        authUser,
        workspace,
      );

      expect(repo.insert).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'slcone', spaceId: 'space-1', rootPageId: 'page-1' }),
        trxMock,
      );
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'service.created', entityKind: 'service' }),
      );
      expect(result).toMatchObject({ id: 'svc-1', tags: [] });
    });
  });

  // ── getService ─────────────────────────────────────────────────────────────

  describe('getService', () => {
    it('throws NotFoundException when service missing', async () => {
      repo.findByIdOrCode.mockResolvedValue(null);
      await expect(service.getService('unknown')).rejects.toThrow(NotFoundException);
    });

    it('returns service with tags', async () => {
      repo.findByIdOrCode.mockResolvedValue({ id: 'svc-1', code: 'slcone' });
      repo.getServiceTags.mockResolvedValue(['payments', 'core']);
      const result = await service.getService('slcone');
      expect(result.tags).toEqual(['payments', 'core']);
    });
  });

  // ── listServices ───────────────────────────────────────────────────────────

  describe('listServices', () => {
    it('delegates to repo with defaults', async () => {
      repo.findAll.mockResolvedValue({ items: [], total: 0 });
      await service.listServices({} as any);
      expect(repo.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 20, offset: 0 }),
      );
    });
  });

  // ── retireService ──────────────────────────────────────────────────────────

  describe('retireService', () => {
    it('throws NotFoundException for missing service', async () => {
      repo.findByIdOrCode.mockResolvedValue(null);
      await expect(service.retireService('bad-id', authUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('calls retire and logs audit', async () => {
      repo.findByIdOrCode.mockResolvedValue({
        id: 'svc-1',
        lifecycle_state: 'active',
      });
      repo.retire.mockResolvedValue({ id: 'svc-1', lifecycle_state: 'retired' });

      await service.retireService('svc-1', authUser);

      expect(repo.retire).toHaveBeenCalledWith('svc-1');
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'service.retired' }),
      );
    });
  });

  // ── updateService ──────────────────────────────────────────────────────────

  describe('updateService', () => {
    it('updates fields and logs diff', async () => {
      repo.findByIdOrCode.mockResolvedValue({
        id: 'svc-1',
        name: 'Old',
        domain: null,
        lifecycle_state: 'active',
      });

      const updated = { id: 'svc-1', name: 'New', domain: null, lifecycle_state: 'active' };
      const trxMock: any = {};
      db.transaction.mockReturnValue({
        execute: jest.fn(async (cb) => {
          repo.update.mockResolvedValue(updated);
          return cb(trxMock);
        }),
      });
      repo.getServiceTags.mockResolvedValue([]);

      await service.updateService({ id: 'svc-1', name: 'New' } as any, authUser);

      expect(repo.update).toHaveBeenCalled();
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'service.updated' }),
      );
    });
  });

  // ── listTags ──────────────────────────────────────────────────────────────

  describe('listTags', () => {
    it('returns tags from repo', async () => {
      repo.listTags.mockResolvedValue([{ id: 't1', name: 'core' }]);
      const result = await service.listTags();
      expect(result).toHaveLength(1);
    });
  });
});
