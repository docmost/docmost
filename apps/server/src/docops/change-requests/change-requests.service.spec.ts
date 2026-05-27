import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { KYSELY_MODULE_CONNECTION_TOKEN } from 'nestjs-kysely';
import { ChangeRequestsService } from './change-requests.service';
import { ChangeRequestsRepository } from './change-requests.repository';
import { CrEventsEmitter } from './events/cr-events.emitter';
import { AuditService } from '../audit/audit.service';
import { WebhookDeliveryService } from '../webhooks/webhook-delivery.service';
import { QueueName } from '../../integrations/queue/constants';
import { DOCOPS_CR_EMAIL_QUEUE, CR_NOTIFY_EMAIL_JOB } from './cr-notify-email.constants';

// ── Mock factories ────────────────────────────────────────────────────────────

const mockAudit = () => ({ log: jest.fn().mockResolvedValue(undefined) });
const mockWebhook = () => ({ deliver: jest.fn().mockResolvedValue(undefined) });
const mockQueue = () => ({ add: jest.fn().mockResolvedValue(undefined) });
const mockEventsEmitter = () => ({
  emitTransition: jest.fn(),
  emitPublished: jest.fn(),
});

const mockRepo = (cr: any = null) => ({
  findById: jest.fn().mockResolvedValue(cr),
  insert: jest.fn().mockResolvedValue(cr ?? {}),
  updateById: jest.fn().mockResolvedValue(undefined),
  insertEvent: jest.fn().mockResolvedValue(undefined),
  listWithCount: jest.fn().mockResolvedValue({ items: [], total: 0 }),
  getEvents: jest.fn().mockResolvedValue([]),
  getExternalRefs: jest.fn().mockResolvedValue([]),
  countActiveCrs: jest.fn().mockResolvedValue(0),
  getExternalRefCount: jest.fn().mockResolvedValue(0),
  getUserRoles: jest.fn().mockResolvedValue([]),
});

const buildDbMock = (selectResult: any = null) => {
  const mock: any = {
    selectFrom: jest.fn().mockReturnThis(),
    selectAll: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    executeTakeFirst: jest.fn().mockResolvedValue(selectResult),
    executeTakeFirstOrThrow: jest.fn().mockResolvedValue(selectResult ?? {}),
    execute: jest.fn().mockResolvedValue({ rows: [] }),
    updateTable: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    insertInto: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    deleteFrom: jest.fn().mockReturnThis(),
    fn: {
      countAll: jest.fn().mockReturnValue({ as: jest.fn().mockReturnValue('count') }),
    },
  };
  return mock;
};

const buildModule = async (cr: any = null) => {
  const dbMock = buildDbMock(cr);
  const repoMock = mockRepo(cr);
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      ChangeRequestsService,
      { provide: ChangeRequestsRepository, useValue: repoMock },
      { provide: CrEventsEmitter, useValue: mockEventsEmitter() },
      { provide: AuditService, useValue: mockAudit() },
      { provide: WebhookDeliveryService, useValue: mockWebhook() },
      { provide: getQueueToken(QueueName.SEARCH_QUEUE), useValue: mockQueue() },
      { provide: getQueueToken(DOCOPS_CR_EMAIL_QUEUE), useValue: mockQueue() },
      { provide: KYSELY_MODULE_CONNECTION_TOKEN(), useValue: dbMock },
    ],
  }).compile();

  return {
    service: module.get(ChangeRequestsService),
    db: dbMock,
    repo: repoMock,
  };
};

// ── validateTransition (pure logic — tested directly) ─────────────────────────

describe('ChangeRequestsService — validateTransition', () => {
  let svc: ChangeRequestsService;

  beforeEach(async () => {
    ({ service: svc } = await buildModule());
  });

  const call = (
    action: string,
    status: string,
    roles: string[],
    isAdmin = false,
    actorId = 'u1',
    creatorId = 'u1',
    reason?: string,
  ) => (svc as any).validateTransition(action, status, roles, isAdmin, actorId, creatorId, reason);

  // ── Unknown action ────────────────────────────────────────────────────────

  it('throws BadRequestException for unknown action', () => {
    expect(() => call('fly_to_moon', 'IN_REVIEW', [])).toThrow(BadRequestException);
  });

  // ── Wrong source state ────────────────────────────────────────────────────

  it.each([
    ['approve', 'IN_PROGRESS', ['APPROVER'], 'reason'],
    ['approve', 'IN_VERIFICATION', ['APPROVER'], 'reason'],
    ['verify', 'IN_REVIEW', ['TECH_LEAD'], undefined],
    ['verify', 'IN_PROGRESS', ['TECH_LEAD'], undefined],
    ['assign_to_self', 'IN_REVIEW', ['DEVELOPER'], undefined],
    ['assign_to_self', 'IN_VERIFICATION', ['DEVELOPER'], undefined],
    ['publish', 'IN_REVIEW', ['TECH_LEAD'], undefined],
    ['publish', 'IN_VERIFICATION', ['TECH_LEAD'], undefined],
    ['close', 'PUBLISHED', ['APPROVER'], 'reason'],
    ['close', 'CLOSED', ['APPROVER'], 'reason'],
  ])(
    'action=%s from status=%s throws BadRequestException',
    (action, status, roles, reason) => {
      expect(() => call(action, status, roles, false, 'u1', 'u1', reason as any)).toThrow(
        BadRequestException,
      );
    },
  );

  // ── Missing reason ────────────────────────────────────────────────────────

  it('approve without reason throws BadRequestException', () => {
    expect(() => call('approve', 'IN_REVIEW', ['APPROVER'], false, 'u1', 'u1', undefined)).toThrow(
      BadRequestException,
    );
  });

  it('close without reason throws BadRequestException', () => {
    // close is guarded by the transition() method before validateTransition,
    // but the state machine's requiresReason also enforces it
    expect(() => call('close', 'IN_REVIEW', ['APPROVER'], false, 'u1', 'u1', undefined)).toThrow(
      BadRequestException,
    );
  });

  it('approve with empty-string reason throws BadRequestException', () => {
    expect(() => call('approve', 'IN_REVIEW', ['APPROVER'], false, 'u1', 'u1', '   ')).toThrow(
      BadRequestException,
    );
  });

  // ── Role checks: wrong role → ForbiddenException ─────────────────────────

  it.each([
    ['approve', 'IN_REVIEW', 'DEVELOPER', 'reason'],
    ['approve', 'IN_REVIEW', 'TECH_LEAD', 'reason'],
    ['verify', 'IN_VERIFICATION', 'APPROVER', undefined],
    ['verify', 'IN_VERIFICATION', 'DEVELOPER', undefined],
    ['assign_to_self', 'IN_PROGRESS', 'APPROVER', undefined],
    ['assign_to_self', 'IN_PROGRESS', 'TECH_LEAD', undefined],
    ['publish', 'IN_PROGRESS', 'DEVELOPER', undefined],
    ['close', 'IN_VERIFICATION', 'APPROVER', 'reason'],
    ['close', 'IN_REVIEW', 'DEVELOPER', 'reason'],
    ['close', 'IN_REVIEW', 'TECH_LEAD', 'reason'],
  ])(
    'action=%s with wrong role=%s throws ForbiddenException',
    (action, status, wrongRole, reason) => {
      expect(() =>
        call(action, status, [wrongRole], false, 'u1', 'u1', reason as any),
      ).toThrow(ForbiddenException);
    },
  );

  // ── Role checks: correct role → no throw ─────────────────────────────────

  it.each([
    ['approve', 'IN_REVIEW', 'APPROVER', 'approved'],
    ['verify', 'IN_VERIFICATION', 'TECH_LEAD', undefined],
    ['assign_to_self', 'IN_PROGRESS', 'DEVELOPER', undefined],
    ['publish', 'IN_PROGRESS', 'TECH_LEAD', undefined],
    ['publish', 'IN_PROGRESS', 'APPROVER', undefined],
    ['close', 'IN_REVIEW', 'APPROVER', 'reason'],
  ])(
    'action=%s with correct role=%s does not throw',
    (action, status, role, reason) => {
      expect(() =>
        call(action, status, [role], false, 'u1', 'u1', reason as any),
      ).not.toThrow();
    },
  );

  // ── Admin override ────────────────────────────────────────────────────────

  it('admin can approve from IN_REVIEW', () => {
    expect(() => call('approve', 'IN_REVIEW', [], true, 'u1', 'u1', 'reason')).not.toThrow();
  });

  it('admin can verify from IN_VERIFICATION', () => {
    expect(() => call('verify', 'IN_VERIFICATION', [], true)).not.toThrow();
  });

  it('admin can publish from IN_PROGRESS', () => {
    expect(() => call('publish', 'IN_PROGRESS', [], true)).not.toThrow();
  });

  it('admin can close from IN_REVIEW', () => {
    expect(() => call('close', 'IN_REVIEW', [], true, 'u1', 'u1', 'reason')).not.toThrow();
  });

  it('admin can close from IN_VERIFICATION', () => {
    expect(() =>
      call('close', 'IN_VERIFICATION', [], true, 'u1', 'u1', 'reason'),
    ).not.toThrow();
  });

  it('admin can close from IN_PROGRESS', () => {
    expect(() =>
      call('close', 'IN_PROGRESS', [], true, 'u1', 'u1', 'reason'),
    ).not.toThrow();
  });

  it('non-admin APPROVER cannot close from IN_VERIFICATION', () => {
    expect(() =>
      call('close', 'IN_VERIFICATION', ['APPROVER'], false, 'u1', 'u1', 'reason'),
    ).toThrow(ForbiddenException);
  });

  it('non-admin APPROVER cannot close from IN_PROGRESS', () => {
    expect(() =>
      call('close', 'IN_PROGRESS', ['APPROVER'], false, 'u1', 'u1', 'reason'),
    ).toThrow(ForbiddenException);
  });
});

// ── closeReason guards (checked in transition() before validateTransition) ────

describe('ChangeRequestsService — closeReason guards', () => {
  const baseCr = {
    id: 'cr-1',
    status: 'IN_REVIEW',
    implementerId: null,
    requestedById: 'owner-1',
    serviceId: 'svc-1',
    pageId: 'page-1',
    rowVersion: 0,
    title: 'Test CR',
  };

  it('close without closeReason throws BadRequestException', async () => {
    const repo = mockRepo(baseCr);
    repo.getUserRoles.mockResolvedValue(['APPROVER']);

    const module = await Test.createTestingModule({
      providers: [
        ChangeRequestsService,
        { provide: ChangeRequestsRepository, useValue: repo },
        { provide: CrEventsEmitter, useValue: mockEventsEmitter() },
        { provide: AuditService, useValue: mockAudit() },
        { provide: WebhookDeliveryService, useValue: mockWebhook() },
        { provide: getQueueToken(QueueName.SEARCH_QUEUE), useValue: mockQueue() },
        { provide: getQueueToken(DOCOPS_CR_EMAIL_QUEUE), useValue: mockQueue() },
        { provide: KYSELY_MODULE_CONNECTION_TOKEN(), useValue: buildDbMock() },
      ],
    }).compile();
    const svc = module.get(ChangeRequestsService);

    await expect(
      svc.transition({ id: 'cr-1', action: 'close' } as any, { id: 'u1' } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('approve with closeReason throws BadRequestException', async () => {
    const repo = mockRepo(baseCr);
    repo.getUserRoles.mockResolvedValue(['APPROVER']);

    const module = await Test.createTestingModule({
      providers: [
        ChangeRequestsService,
        { provide: ChangeRequestsRepository, useValue: repo },
        { provide: CrEventsEmitter, useValue: mockEventsEmitter() },
        { provide: AuditService, useValue: mockAudit() },
        { provide: WebhookDeliveryService, useValue: mockWebhook() },
        { provide: getQueueToken(QueueName.SEARCH_QUEUE), useValue: mockQueue() },
        { provide: getQueueToken(DOCOPS_CR_EMAIL_QUEUE), useValue: mockQueue() },
        { provide: KYSELY_MODULE_CONNECTION_TOKEN(), useValue: buildDbMock() },
      ],
    }).compile();
    const svc = module.get(ChangeRequestsService);

    await expect(
      svc.transition(
        { id: 'cr-1', action: 'approve', closeReason: 'REJECTED', reason: 'ok' } as any,
        { id: 'u1' } as any,
      ),
    ).rejects.toThrow(BadRequestException);
  });
});

// ── assign_to_self conflict ───────────────────────────────────────────────────

describe('ChangeRequestsService — assign_to_self conflict', () => {
  const makeRepo = (implementerId: string | null) => {
    const cr = {
      id: 'cr-1',
      status: 'IN_PROGRESS',
      implementerId,
      requestedById: 'owner-1',
      serviceId: 'svc-1',
      pageId: 'page-1',
      rowVersion: 0,
      title: 'Test CR',
    };
    const repo = mockRepo(cr);
    repo.getUserRoles.mockResolvedValue(['DEVELOPER']);
    // getEvents and getExternalRefs for getChangeRequest call after transition
    repo.getEvents.mockResolvedValue([]);
    repo.getExternalRefs.mockResolvedValue([]);
    return { cr, repo };
  };

  // Helper: build a db mock where transaction().execute(cb) calls cb with the same mock
  const buildTxDbMock = () => {
    const dbMock = buildDbMock();
    dbMock.returning = jest.fn().mockReturnThis();
    // executeTx calls db.transaction().execute(cb)
    dbMock.transaction = jest.fn().mockReturnValue({
      execute: jest.fn().mockImplementation((cb: any) => cb(dbMock)),
    });
    return dbMock;
  };

  it('throws ConflictException when CR is assigned to a different implementer', async () => {
    const { repo } = makeRepo('other-dev');
    const dbMock = buildTxDbMock();

    const module = await Test.createTestingModule({
      providers: [
        ChangeRequestsService,
        { provide: ChangeRequestsRepository, useValue: repo },
        { provide: CrEventsEmitter, useValue: mockEventsEmitter() },
        { provide: AuditService, useValue: mockAudit() },
        { provide: WebhookDeliveryService, useValue: mockWebhook() },
        { provide: getQueueToken(QueueName.SEARCH_QUEUE), useValue: mockQueue() },
        { provide: getQueueToken(DOCOPS_CR_EMAIL_QUEUE), useValue: mockQueue() },
        { provide: KYSELY_MODULE_CONNECTION_TOKEN(), useValue: dbMock },
      ],
    }).compile();
    const svc = module.get(ChangeRequestsService);

    await expect(
      svc.transition({ id: 'cr-1', action: 'assign_to_self' } as any, { id: 'actor-dev' } as any),
    ).rejects.toThrow(ConflictException);
  });

  it('does not throw ConflictException when same user re-assigns (idempotent)', async () => {
    const { repo } = makeRepo('actor-dev');
    const dbMock = buildTxDbMock();

    const module = await Test.createTestingModule({
      providers: [
        ChangeRequestsService,
        { provide: ChangeRequestsRepository, useValue: repo },
        { provide: CrEventsEmitter, useValue: mockEventsEmitter() },
        { provide: AuditService, useValue: mockAudit() },
        { provide: WebhookDeliveryService, useValue: mockWebhook() },
        { provide: getQueueToken(QueueName.SEARCH_QUEUE), useValue: mockQueue() },
        { provide: getQueueToken(DOCOPS_CR_EMAIL_QUEUE), useValue: mockQueue() },
        { provide: KYSELY_MODULE_CONNECTION_TOKEN(), useValue: dbMock },
      ],
    }).compile();
    const svc = module.get(ChangeRequestsService);

    await expect(
      svc.transition(
        { id: 'cr-1', action: 'assign_to_self' } as any,
        { id: 'actor-dev' } as any,
      ),
    ).resolves.toBeDefined();
  });
});

// ── createChangeRequest active CR constraint ───────────────────────────────────

describe('ChangeRequestsService — createChangeRequest active CR constraint', () => {
  it('throws ConflictException when countActiveCrs > 0', async () => {
    const dbMock = buildDbMock({ id: 'svc-1' }); // service + page found
    const repoMock = mockRepo(null);
    repoMock.countActiveCrs.mockResolvedValue(1);

    const module = await Test.createTestingModule({
      providers: [
        ChangeRequestsService,
        { provide: ChangeRequestsRepository, useValue: repoMock },
        { provide: CrEventsEmitter, useValue: mockEventsEmitter() },
        { provide: AuditService, useValue: mockAudit() },
        { provide: WebhookDeliveryService, useValue: mockWebhook() },
        { provide: getQueueToken(QueueName.SEARCH_QUEUE), useValue: mockQueue() },
        { provide: getQueueToken(DOCOPS_CR_EMAIL_QUEUE), useValue: mockQueue() },
        { provide: KYSELY_MODULE_CONNECTION_TOKEN(), useValue: dbMock },
      ],
    }).compile();
    const svc = module.get(ChangeRequestsService);

    const dto = {
      serviceId: 'svc-1',
      pageId: 'page-1',
      title: 'New CR',
      description: '',
      justification: 'Needed',
      priority: 'MEDIUM',
      impact: 'LOW',
    } as any;

    await expect(
      svc.createChangeRequest(dto, { id: 'u1' } as any),
    ).rejects.toThrow(ConflictException);

    expect(repoMock.countActiveCrs).toHaveBeenCalledWith(
      dto.serviceId,
      '00000000-0000-0000-0000-000000000000',
    );
  });
});

// ── transition integration tests ─────────────────────────────────────────────

describe('ChangeRequestsService — transition integration', () => {
  // Helper: build a db mock where transaction().execute(cb) calls cb with the same mock
  const buildTxDbMock = (executeTakeFirstResult: any = null) => {
    const dbMock = buildDbMock(executeTakeFirstResult);
    dbMock.returning = jest.fn().mockReturnThis();
    dbMock.returningAll = jest.fn().mockReturnThis();
    dbMock.transaction = jest.fn().mockReturnValue({
      execute: jest.fn().mockImplementation((cb: any) => cb(dbMock)),
    });
    return dbMock;
  };

  it('publish: throws BadRequestException when no external refs', async () => {
    const cr = {
      id: 'cr-1',
      status: 'IN_PROGRESS',
      implementerId: null,
      requestedById: 'u1',
      serviceId: 'svc-1',
      pageId: 'p1',
      title: 'T',
      rowVersion: 0,
    };
    const repo = mockRepo(cr);
    repo.getUserRoles.mockResolvedValue(['TECH_LEAD']);
    repo.getEvents.mockResolvedValue([]);
    repo.getExternalRefs.mockResolvedValue([]);

    // executeTakeFirst returns { count: '0' } for the external_refs count query
    const dbMock = buildTxDbMock({ count: '0' });

    const module = await Test.createTestingModule({
      providers: [
        ChangeRequestsService,
        { provide: ChangeRequestsRepository, useValue: repo },
        { provide: CrEventsEmitter, useValue: mockEventsEmitter() },
        { provide: AuditService, useValue: mockAudit() },
        { provide: WebhookDeliveryService, useValue: mockWebhook() },
        { provide: getQueueToken(QueueName.SEARCH_QUEUE), useValue: mockQueue() },
        { provide: getQueueToken(DOCOPS_CR_EMAIL_QUEUE), useValue: mockQueue() },
        { provide: KYSELY_MODULE_CONNECTION_TOKEN(), useValue: dbMock },
      ],
    }).compile();
    const svc = module.get(ChangeRequestsService);

    await expect(
      svc.transition(
        { id: 'cr-1', action: 'publish' } as any,
        { id: 'u1' } as any,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('transition: throws ConflictException on rowVersion mismatch', async () => {
    const cr = {
      id: 'cr-1',
      status: 'IN_REVIEW',
      rowVersion: 5,
      requestedById: 'u1',
      serviceId: 'svc-1',
      pageId: 'p1',
      title: 'T',
      implementerId: null,
    };
    const repo = mockRepo(cr);
    repo.getUserRoles.mockResolvedValue(['APPROVER']);

    const dbMock = buildTxDbMock();

    const module = await Test.createTestingModule({
      providers: [
        ChangeRequestsService,
        { provide: ChangeRequestsRepository, useValue: repo },
        { provide: CrEventsEmitter, useValue: mockEventsEmitter() },
        { provide: AuditService, useValue: mockAudit() },
        { provide: WebhookDeliveryService, useValue: mockWebhook() },
        { provide: getQueueToken(QueueName.SEARCH_QUEUE), useValue: mockQueue() },
        { provide: getQueueToken(DOCOPS_CR_EMAIL_QUEUE), useValue: mockQueue() },
        { provide: KYSELY_MODULE_CONNECTION_TOKEN(), useValue: dbMock },
      ],
    }).compile();
    const svc = module.get(ChangeRequestsService);

    await expect(
      svc.transition(
        { id: 'cr-1', action: 'approve', rowVersion: 3, reason: 'ok' } as any,
        { id: 'u1' } as any,
      ),
    ).rejects.toThrow(ConflictException);
  });
});

// ── saveDraftContent ──────────────────────────────────────────────────────────

describe('ChangeRequestsService — saveDraftContent', () => {
  it('throws NotFoundException when CR not found', async () => {
    const { service } = await buildModule(null);
    await expect(
      service.saveDraftContent({ changeRequestId: 'cr-1', content: {} }, { id: 'u1' } as any),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when status !== IN_PROGRESS', async () => {
    const { service } = await buildModule({
      id: 'cr-1',
      status: 'IN_REVIEW',
      implementerId: 'u1',
      pageId: 'p1',
    });
    await expect(
      service.saveDraftContent({ changeRequestId: 'cr-1', content: {} }, { id: 'u1' } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when status is IN_VERIFICATION', async () => {
    const { service } = await buildModule({
      id: 'cr-1',
      status: 'IN_VERIFICATION',
      implementerId: 'u1',
      pageId: 'p1',
    });
    await expect(
      service.saveDraftContent({ changeRequestId: 'cr-1', content: {} }, { id: 'u1' } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws ForbiddenException when user is not the implementer', async () => {
    const { service } = await buildModule({
      id: 'cr-1',
      status: 'IN_PROGRESS',
      implementerId: 'other',
      pageId: 'p1',
    });
    await expect(
      service.saveDraftContent({ changeRequestId: 'cr-1', content: {} }, { id: 'u1' } as any),
    ).rejects.toThrow(ForbiddenException);
  });

  it('returns { saved: true } when implementer saves draft in IN_PROGRESS', async () => {
    const { service, db } = await buildModule({
      id: 'cr-1',
      status: 'IN_PROGRESS',
      implementerId: 'u1',
      pageId: 'p1',
    });
    db.updateTable.mockReturnThis();
    db.set.mockReturnThis();
    db.where.mockReturnThis();
    db.execute.mockResolvedValue([]);

    const result = await service.saveDraftContent(
      { changeRequestId: 'cr-1', content: { type: 'doc' } },
      { id: 'u1' } as any,
    );
    expect(result).toEqual({ saved: true });
  });
});

// ── getEvents ─────────────────────────────────────────────────────────────────

describe('ChangeRequestsService — getEvents', () => {
  it('throws NotFoundException when CR not found', async () => {
    const { service } = await buildModule(null);
    await expect(service.getEvents('missing-cr')).rejects.toThrow(NotFoundException);
  });
});

// ── sendTransitionNotification — BullMQ job dispatch ─────────────────────────

describe('ChangeRequestsService — sendTransitionNotification', () => {
  const baseCrAny = {
    id: 'cr-1',
    title: 'Test CR',
    justification: 'Motivazione di test sufficientemente lunga.',
    serviceId: 'svc-1',
    requestedById: 'requester-1',
    status: 'IN_PROGRESS',
    pageId: 'page-1',
    rowVersion: 0,
  };

  let crEmailQueue: { add: jest.Mock };
  let svc: ChangeRequestsService;

  beforeEach(async () => {
    crEmailQueue = { add: jest.fn().mockResolvedValue(undefined) };

    const module = await Test.createTestingModule({
      providers: [
        ChangeRequestsService,
        { provide: ChangeRequestsRepository, useValue: mockRepo(baseCrAny) },
        { provide: CrEventsEmitter, useValue: mockEventsEmitter() },
        { provide: AuditService, useValue: mockAudit() },
        { provide: WebhookDeliveryService, useValue: mockWebhook() },
        { provide: getQueueToken(QueueName.SEARCH_QUEUE), useValue: mockQueue() },
        { provide: getQueueToken(DOCOPS_CR_EMAIL_QUEUE), useValue: crEmailQueue },
        { provide: KYSELY_MODULE_CONNECTION_TOKEN(), useValue: buildDbMock() },
      ],
    }).compile();

    svc = module.get(ChangeRequestsService);
  });

  const actor = (name: string, id = 'actor-1') => ({ id, name } as any);

  it.each(['approve', 'verify', 'publish'])(
    '%s: dispatches cr.notify.email job',
    async (action) => {
      await (svc as any).sendTransitionNotification(action, 'cr-1', baseCrAny, actor('Mario'));
      expect(crEmailQueue.add).toHaveBeenCalledWith(
        CR_NOTIFY_EMAIL_JOB,
        expect.objectContaining({ action, crId: 'cr-1' }),
      );
    },
  );

  it('approve: job payload contains actorName and crData', async () => {
    await (svc as any).sendTransitionNotification('approve', 'cr-1', baseCrAny, actor('Mario'));
    expect(crEmailQueue.add).toHaveBeenCalledWith(
      CR_NOTIFY_EMAIL_JOB,
      expect.objectContaining({
        actorName: 'Mario',
        crData: expect.objectContaining({
          title: 'Test CR',
          serviceId: 'svc-1',
          justification: baseCrAny.justification,
        }),
      }),
    );
  });

  it.each(['assign_to_self', 'close'])(
    '%s: does not dispatch any job',
    async (action) => {
      await (svc as any).sendTransitionNotification(action, 'cr-1', baseCrAny, actor('PO'));
      expect(crEmailQueue.add).not.toHaveBeenCalled();
    },
  );
});

// ── E2E smoke: IN_REVIEW → PUBLISHED state machine ───────────────────────────
//
// Exercises validateTransition (pure logic) across all 5 states.
// Each step: correct role passes, wrong role fails, wrong source state fails.

describe('E2E smoke: IN_REVIEW → PUBLISHED state machine', () => {
  let svc: ChangeRequestsService;

  beforeEach(async () => {
    ({ service: svc } = await buildModule());
  });

  const call = (
    action: string,
    status: string,
    roles: string[],
    isAdmin = false,
    actorId = 'actor',
    creatorId = 'actor',
    reason?: string,
  ) => (svc as any).validateTransition(action, status, roles, isAdmin, actorId, creatorId, reason);

  // Step 1: IN_REVIEW → IN_VERIFICATION (approve)
  describe('Step 1: approve (IN_REVIEW → IN_VERIFICATION)', () => {
    it('APPROVER with reason succeeds', () => {
      expect(() => call('approve', 'IN_REVIEW', ['APPROVER'], false, 'actor', 'actor', 'looks good')).not.toThrow();
    });
    it('APPROVER without reason throws', () => {
      expect(() => call('approve', 'IN_REVIEW', ['APPROVER'])).toThrow(BadRequestException);
    });
    it('DEVELOPER is forbidden', () => {
      expect(() => call('approve', 'IN_REVIEW', ['DEVELOPER'], false, 'actor', 'actor', 'ok')).toThrow(
        ForbiddenException,
      );
    });
    it('TECH_LEAD is forbidden', () => {
      expect(() => call('approve', 'IN_REVIEW', ['TECH_LEAD'], false, 'actor', 'actor', 'ok')).toThrow(
        ForbiddenException,
      );
    });
    it('wrong source state (IN_PROGRESS) throws', () => {
      expect(() => call('approve', 'IN_PROGRESS', ['APPROVER'], false, 'actor', 'actor', 'ok')).toThrow(
        BadRequestException,
      );
    });
  });

  // Step 2: IN_VERIFICATION → IN_PROGRESS (verify)
  describe('Step 2: verify (IN_VERIFICATION → IN_PROGRESS)', () => {
    it('TECH_LEAD succeeds', () => {
      expect(() => call('verify', 'IN_VERIFICATION', ['TECH_LEAD'])).not.toThrow();
    });
    it('APPROVER is forbidden', () => {
      expect(() => call('verify', 'IN_VERIFICATION', ['APPROVER'])).toThrow(ForbiddenException);
    });
    it('DEVELOPER is forbidden', () => {
      expect(() => call('verify', 'IN_VERIFICATION', ['DEVELOPER'])).toThrow(ForbiddenException);
    });
    it('wrong source state (IN_REVIEW) throws', () => {
      expect(() => call('verify', 'IN_REVIEW', ['TECH_LEAD'])).toThrow(BadRequestException);
    });
  });

  // Step 3: IN_PROGRESS → IN_PROGRESS (assign_to_self — self-loop)
  describe('Step 3: assign_to_self (IN_PROGRESS → IN_PROGRESS)', () => {
    it('DEVELOPER succeeds', () => {
      expect(() => call('assign_to_self', 'IN_PROGRESS', ['DEVELOPER'])).not.toThrow();
    });
    it('APPROVER is forbidden', () => {
      expect(() => call('assign_to_self', 'IN_PROGRESS', ['APPROVER'])).toThrow(ForbiddenException);
    });
    it('TECH_LEAD is forbidden', () => {
      expect(() => call('assign_to_self', 'IN_PROGRESS', ['TECH_LEAD'])).toThrow(ForbiddenException);
    });
    it('wrong source state (IN_REVIEW) throws', () => {
      expect(() => call('assign_to_self', 'IN_REVIEW', ['DEVELOPER'])).toThrow(BadRequestException);
    });
    it('wrong source state (IN_VERIFICATION) throws', () => {
      expect(() => call('assign_to_self', 'IN_VERIFICATION', ['DEVELOPER'])).toThrow(
        BadRequestException,
      );
    });
  });

  // Step 4: IN_PROGRESS → PUBLISHED (publish)
  describe('Step 4: publish (IN_PROGRESS → PUBLISHED)', () => {
    it('TECH_LEAD succeeds', () => {
      expect(() => call('publish', 'IN_PROGRESS', ['TECH_LEAD'])).not.toThrow();
    });
    it('APPROVER also succeeds', () => {
      expect(() => call('publish', 'IN_PROGRESS', ['APPROVER'])).not.toThrow();
    });
    it('DEVELOPER is forbidden', () => {
      expect(() => call('publish', 'IN_PROGRESS', ['DEVELOPER'])).toThrow(ForbiddenException);
    });
    it('wrong source state (IN_VERIFICATION) throws', () => {
      expect(() => call('publish', 'IN_VERIFICATION', ['TECH_LEAD'])).toThrow(BadRequestException);
    });
    it('wrong source state (IN_REVIEW) throws', () => {
      expect(() => call('publish', 'IN_REVIEW', ['TECH_LEAD'])).toThrow(BadRequestException);
    });
  });

  // close: active states → CLOSED
  describe('close: active states → CLOSED', () => {
    it('APPROVER can close from IN_REVIEW', () => {
      expect(() =>
        call('close', 'IN_REVIEW', ['APPROVER'], false, 'actor', 'actor', 'REJECTED'),
      ).not.toThrow();
    });
    it('APPROVER cannot close from IN_VERIFICATION', () => {
      expect(() =>
        call('close', 'IN_VERIFICATION', ['APPROVER'], false, 'actor', 'actor', 'REJECTED'),
      ).toThrow(ForbiddenException);
    });
    it('Admin can close from IN_REVIEW', () => {
      expect(() => call('close', 'IN_REVIEW', [], true, 'actor', 'actor', 'REJECTED')).not.toThrow();
    });
    it('Admin can close from IN_VERIFICATION', () => {
      expect(() => call('close', 'IN_VERIFICATION', [], true, 'actor', 'actor', 'CANCELLED')).not.toThrow();
    });
    it('Admin can close from IN_PROGRESS', () => {
      expect(() => call('close', 'IN_PROGRESS', [], true, 'actor', 'actor', 'CANCELLED')).not.toThrow();
    });
    it('close without reason throws (requiresReason)', () => {
      expect(() => call('close', 'IN_REVIEW', ['APPROVER'], false, 'actor', 'actor', undefined)).toThrow(
        BadRequestException,
      );
    });
    it('close from PUBLISHED throws (not an active state)', () => {
      expect(() => call('close', 'PUBLISHED', [], true, 'actor', 'actor', 'CANCELLED')).toThrow(BadRequestException);
    });
    it('close from CLOSED throws (not an active state)', () => {
      expect(() => call('close', 'CLOSED', [], true, 'actor', 'actor', 'CANCELLED')).toThrow(BadRequestException);
    });
  });
});
