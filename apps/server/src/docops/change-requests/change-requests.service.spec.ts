import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
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

  const call = (action: string, status: string, roles: string[], isAdmin = false, actorId = 'u1', creatorId = 'u1', reason?: string) =>
    (svc as any).validateTransition(action, status, roles, isAdmin, actorId, creatorId, reason);

  // ── Unknown action ────────────────────────────────────────────────────────

  it('throws BadRequestException for unknown action', () => {
    expect(() => call('fly_to_moon', 'DRAFT', [])).toThrow(BadRequestException);
  });

  // ── Wrong source state ────────────────────────────────────────────────────

  it.each([
    ['approve', 'DRAFT', ['APPROVER'], undefined],
    ['submit', 'APPROVED', ['PROCESS_OWNER'], undefined],
    ['assign_to_self', 'DRAFT', ['DEVELOPER'], undefined],
    ['publish', 'APPROVED', ['TECH_LEAD'], 'some reason'],
    ['reject', 'DRAFT', ['APPROVER'], 'reason'],
  ])('action=%s from status=%s throws BadRequestException', (action, status, roles, reason) => {
    expect(() => call(action, status, roles, false, 'u1', 'u1', reason)).toThrow(BadRequestException);
  });

  // ── Missing reason ────────────────────────────────────────────────────────

  it.each(['approve', 'reject', 'reject_implementation', 'cancel'])(
    'action=%s without reason throws BadRequestException',
    (action) => {
      const statusMap: Record<string, string> = {
        approve: 'IN_REVIEW',
        reject: 'IN_REVIEW',
        reject_implementation: 'IN_VERIFICATION',
        cancel: 'DRAFT',
      };
      const roleMap: Record<string, string> = {
        approve: 'APPROVER',
        reject: 'APPROVER',
        reject_implementation: 'TECH_LEAD',
        cancel: 'PROCESS_OWNER',
      };
      expect(() =>
        call(action, statusMap[action], [roleMap[action]], false, 'u1', 'u1', undefined),
      ).toThrow(BadRequestException);
    },
  );

  // ── Role checks: wrong role → ForbiddenException ─────────────────────────

  it.each([
    ['submit', 'DRAFT', 'APPROVER', 'some reason'],
    ['take_for_review', 'REQUESTED', 'DEVELOPER', undefined],
    ['approve', 'IN_REVIEW', 'DEVELOPER', 'reason'],
    ['reject', 'IN_REVIEW', 'DEVELOPER', 'reason'],
    ['assign_to_self', 'APPROVED', 'APPROVER', undefined],
    ['submit_for_verification', 'IN_IMPLEMENTATION', 'APPROVER', undefined],
    ['reject_implementation', 'IN_VERIFICATION', 'DEVELOPER', 'reason'],
    ['publish', 'IN_VERIFICATION', 'DEVELOPER', undefined],
  ])('action=%s with wrong role=%s throws ForbiddenException', (action, status, wrongRole, reason) => {
    expect(() => call(action, status, [wrongRole], false, 'u1', 'u1', reason as any)).toThrow(
      ForbiddenException,
    );
  });

  // ── Role checks: correct role → no throw ─────────────────────────────────

  it.each([
    ['submit', 'DRAFT', 'PROCESS_OWNER', undefined],
    ['take_for_review', 'REQUESTED', 'APPROVER', undefined],
    ['approve', 'IN_REVIEW', 'APPROVER', 'approved'],
    ['reject', 'IN_REVIEW', 'APPROVER', 'reason'],
    ['assign_to_self', 'APPROVED', 'DEVELOPER', undefined],
    ['submit_for_verification', 'IN_IMPLEMENTATION', 'DEVELOPER', undefined],
    ['reject_implementation', 'IN_VERIFICATION', 'TECH_LEAD', 'reason'],
    ['publish', 'IN_VERIFICATION', 'TECH_LEAD', undefined],
  ])('action=%s with correct role=%s does not throw', (action, status, role, reason) => {
    expect(() => call(action, status, [role], false, 'u1', 'u1', reason as any)).not.toThrow();
  });

  // ── Admin override ────────────────────────────────────────────────────────

  it('admin can close a PUBLISHED CR', () => {
    expect(() => call('close', 'PUBLISHED', [], true)).not.toThrow();
  });

  it('non-admin without correct role cannot close', () => {
    expect(() => call('close', 'PUBLISHED', ['DEVELOPER'])).toThrow(ForbiddenException);
  });

  // ── cancel rules ─────────────────────────────────────────────────────────

  it('creator with PROCESS_OWNER can cancel from DRAFT', () => {
    expect(() =>
      call('cancel', 'DRAFT', ['PROCESS_OWNER'], false, 'u1', 'u1', 'changed mind'),
    ).not.toThrow();
  });

  it('non-creator cannot cancel from DRAFT without admin', () => {
    expect(() =>
      call('cancel', 'DRAFT', ['PROCESS_OWNER'], false, 'u1', 'other-user', 'forced'),
    ).toThrow(ForbiddenException);
  });

  it('admin can cancel from IN_REVIEW', () => {
    expect(() =>
      call('cancel', 'IN_REVIEW', [], true, 'admin', 'u1', 'force cancel'),
    ).not.toThrow();
  });

  it('non-admin cannot cancel from IN_REVIEW', () => {
    expect(() =>
      call('cancel', 'IN_REVIEW', ['PROCESS_OWNER'], false, 'u1', 'u1', 'reason'),
    ).toThrow(ForbiddenException);
  });

  // ── Gap A: submit requires actorId === creatorId ──────────────────────────

  it('submit: creator with PROCESS_OWNER succeeds', () => {
    expect(() => call('submit', 'DRAFT', ['PROCESS_OWNER'], false, undefined, 'u1', 'u1')).not.toThrow();
  });

  it('submit: PROCESS_OWNER who is NOT creator is forbidden', () => {
    expect(() => call('submit', 'DRAFT', ['PROCESS_OWNER'], false, undefined, 'other', 'u1')).toThrow(ForbiddenException);
  });

  it('submit: admin can submit even if not creator', () => {
    expect(() => call('submit', 'DRAFT', [], true, undefined, 'admin', 'u1')).not.toThrow();
  });
});

// ── Gap B: transition submit_for_verification — only assigned implementer ─────

describe('ChangeRequestsService — transition submit_for_verification implementer check', () => {
  const baseCr = {
    id: 'cr-1',
    status: 'IN_IMPLEMENTATION',
    implementerId: 'dev-1',
    requestedById: 'owner-1',
    serviceId: 'svc-1',
    pageId: 'page-1',
    rowVersion: 0,
    title: 'Test CR',
  };

  it('throws ForbiddenException when actor is not the assigned implementer', async () => {
    const repo = mockRepo(baseCr);
    repo.getUserRoles.mockResolvedValue(['DEVELOPER']);

    const { service: svc } = await buildModule(baseCr);
    // Override repo on the already-built module via the mock
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
    const service = module.get(ChangeRequestsService);

    await expect(
      service.transition(
        { id: 'cr-1', action: 'submit_for_verification' },
        { id: 'other-dev' } as any,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('proceeds when actor is the assigned implementer (with external ref)', async () => {
    const repo = mockRepo(baseCr);
    repo.getUserRoles.mockResolvedValue(['DEVELOPER']);
    repo.getExternalRefCount.mockResolvedValue(1);
    repo.findById
      .mockResolvedValueOnce(baseCr)
      .mockResolvedValueOnce({ ...baseCr, status: 'IN_VERIFICATION' });

    const dbMock = buildDbMock();
    // executeTx mock — just run the callback
    dbMock.transaction = jest.fn();

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

    // No ForbiddenException — may throw for other reasons (executeTx needs real db)
    // We verify it does NOT throw ForbiddenException specifically
    let err: any;
    try {
      await svc.transition(
        { id: 'cr-1', action: 'submit_for_verification' },
        { id: 'dev-1', docopsRoles: ['DEVELOPER'] } as any,
      );
    } catch (e) {
      err = e;
    }
    expect(err).not.toBeInstanceOf(ForbiddenException);
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

  it('throws BadRequestException when CR not IN_IMPLEMENTATION', async () => {
    const { service } = await buildModule({ id: 'cr-1', status: 'DRAFT', implementerId: 'u1', pageId: 'p1' });
    await expect(
      service.saveDraftContent({ changeRequestId: 'cr-1', content: {} }, { id: 'u1' } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws ForbiddenException when user is not the implementer', async () => {
    const { service } = await buildModule({ id: 'cr-1', status: 'IN_IMPLEMENTATION', implementerId: 'other', pageId: 'p1' });
    await expect(
      service.saveDraftContent({ changeRequestId: 'cr-1', content: {} }, { id: 'u1' } as any),
    ).rejects.toThrow(ForbiddenException);
  });

  it('returns { saved: true } when implementer saves draft', async () => {
    const { service, db } = await buildModule({ id: 'cr-1', status: 'IN_IMPLEMENTATION', implementerId: 'u1', pageId: 'p1' });
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
    await expect(service.getEvents('missing')).rejects.toThrow(NotFoundException);
  });
});

// ── E2E smoke: DRAFT → PUBLISHED via validateTransition ───────────────────────
//
// Tests the full 8-step state machine in sequence.
// Each step asserts: correct role passes, wrong role fails, wrong source state fails.
// validateTransition is pure logic — no DB needed.

describe('E2E smoke: DRAFT → PUBLISHED state machine', () => {
  let svc: ChangeRequestsService;

  beforeEach(async () => {
    ({ service: svc } = await buildModule());
  });

  const call = (
    action: string,
    status: string,
    roles: string[],
    isAdmin = false,
    reason?: string,
    actorId = 'actor',
    creatorId = 'actor',
  ) => (svc as any).validateTransition(action, status, roles, isAdmin, actorId, creatorId, reason);

  // Step 1: DRAFT → REQUESTED (submit)
  describe('Step 1: submit (DRAFT → REQUESTED)', () => {
    it('PROCESS_OWNER succeeds', () => {
      expect(() => call('submit', 'DRAFT', ['PROCESS_OWNER'])).not.toThrow();
    });
    it('DEVELOPER is forbidden', () => {
      expect(() => call('submit', 'DRAFT', ['DEVELOPER'])).toThrow(ForbiddenException);
    });
    it('wrong source state throws', () => {
      expect(() => call('submit', 'IN_REVIEW', ['PROCESS_OWNER'])).toThrow(BadRequestException);
    });
  });

  // Step 2: REQUESTED → IN_REVIEW (take_for_review)
  describe('Step 2: take_for_review (REQUESTED → IN_REVIEW)', () => {
    it('APPROVER succeeds', () => {
      expect(() => call('take_for_review', 'REQUESTED', ['APPROVER'])).not.toThrow();
    });
    it('PROCESS_OWNER is forbidden', () => {
      expect(() => call('take_for_review', 'REQUESTED', ['PROCESS_OWNER'])).toThrow(ForbiddenException);
    });
    it('wrong source state throws', () => {
      expect(() => call('take_for_review', 'DRAFT', ['APPROVER'])).toThrow(BadRequestException);
    });
  });

  // Step 3: IN_REVIEW → APPROVED (approve)
  describe('Step 3: approve (IN_REVIEW → APPROVED)', () => {
    it('APPROVER with reason succeeds', () => {
      expect(() => call('approve', 'IN_REVIEW', ['APPROVER'], false, 'looks good')).not.toThrow();
    });
    it('APPROVER without reason throws', () => {
      expect(() => call('approve', 'IN_REVIEW', ['APPROVER'])).toThrow(BadRequestException);
    });
    it('DEVELOPER is forbidden', () => {
      expect(() => call('approve', 'IN_REVIEW', ['DEVELOPER'], false, 'ok')).toThrow(ForbiddenException);
    });
    it('wrong source state throws', () => {
      expect(() => call('approve', 'DRAFT', ['APPROVER'], false, 'ok')).toThrow(BadRequestException);
    });
  });

  // Step 4: APPROVED → IN_IMPLEMENTATION (assign_to_self)
  describe('Step 4: assign_to_self (APPROVED → IN_IMPLEMENTATION)', () => {
    it('DEVELOPER succeeds', () => {
      expect(() => call('assign_to_self', 'APPROVED', ['DEVELOPER'])).not.toThrow();
    });
    it('APPROVER is forbidden', () => {
      expect(() => call('assign_to_self', 'APPROVED', ['APPROVER'])).toThrow(ForbiddenException);
    });
    it('wrong source state throws', () => {
      expect(() => call('assign_to_self', 'REQUESTED', ['DEVELOPER'])).toThrow(BadRequestException);
    });
  });

  // Step 5: IN_IMPLEMENTATION → IN_VERIFICATION (submit_for_verification)
  describe('Step 5: submit_for_verification (IN_IMPLEMENTATION → IN_VERIFICATION)', () => {
    it('DEVELOPER succeeds', () => {
      expect(() => call('submit_for_verification', 'IN_IMPLEMENTATION', ['DEVELOPER'])).not.toThrow();
    });
    it('TECH_LEAD is forbidden', () => {
      expect(() => call('submit_for_verification', 'IN_IMPLEMENTATION', ['TECH_LEAD'])).toThrow(ForbiddenException);
    });
    it('wrong source state throws', () => {
      expect(() => call('submit_for_verification', 'APPROVED', ['DEVELOPER'])).toThrow(BadRequestException);
    });
  });

  // Step 6: IN_VERIFICATION → PUBLISHED (publish)
  describe('Step 6: publish (IN_VERIFICATION → PUBLISHED)', () => {
    it('TECH_LEAD succeeds', () => {
      expect(() => call('publish', 'IN_VERIFICATION', ['TECH_LEAD'])).not.toThrow();
    });
    it('APPROVER also succeeds (S1 fix)', () => {
      expect(() => call('publish', 'IN_VERIFICATION', ['APPROVER'])).not.toThrow();
    });
    it('DEVELOPER is forbidden', () => {
      expect(() => call('publish', 'IN_VERIFICATION', ['DEVELOPER'])).toThrow(ForbiddenException);
    });
    it('wrong source state throws', () => {
      expect(() => call('publish', 'IN_IMPLEMENTATION', ['TECH_LEAD'])).toThrow(BadRequestException);
    });
  });

  // Step 7: PUBLISHED → CLOSED (close)
  describe('Step 7: close (PUBLISHED → CLOSED)', () => {
    it('Admin succeeds', () => {
      expect(() => call('close', 'PUBLISHED', [], true)).not.toThrow();
    });
    it('non-admin is forbidden', () => {
      expect(() => call('close', 'PUBLISHED', ['TECH_LEAD'])).toThrow(ForbiddenException);
    });
    it('wrong source state throws', () => {
      expect(() => call('close', 'IN_REVIEW', [], true)).toThrow(BadRequestException);
    });
  });

  // Terminal: reject at IN_REVIEW
  describe('Terminal: reject (IN_REVIEW → REJECTED)', () => {
    it('APPROVER with reason succeeds', () => {
      expect(() => call('reject', 'IN_REVIEW', ['APPROVER'], false, 'not acceptable')).not.toThrow();
    });
    it('APPROVER without reason throws', () => {
      expect(() => call('reject', 'IN_REVIEW', ['APPROVER'])).toThrow(BadRequestException);
    });
  });

  // Terminal: reject_implementation at IN_VERIFICATION
  describe('Terminal: reject_implementation (IN_VERIFICATION → IN_IMPLEMENTATION)', () => {
    it('TECH_LEAD with reason succeeds', () => {
      expect(() => call('reject_implementation', 'IN_VERIFICATION', ['TECH_LEAD'], false, 'needs rework')).not.toThrow();
    });
    it('DEVELOPER is forbidden', () => {
      expect(() => call('reject_implementation', 'IN_VERIFICATION', ['DEVELOPER'], false, 'reason')).toThrow(ForbiddenException);
    });
  });

  // Gap A: submit creator check in E2E context
  describe('Gap A: submit requires actorId === creatorId', () => {
    it('succeeds when actor is the creator', () => {
      expect(() => call('submit', 'DRAFT', ['PROCESS_OWNER'], false, undefined, 'creator-user', 'creator-user')).not.toThrow();
    });
    it('non-creator PROCESS_OWNER is forbidden', () => {
      expect(() => call('submit', 'DRAFT', ['PROCESS_OWNER'], false, undefined, 'other-user', 'creator-user')).toThrow(ForbiddenException);
    });
  });

  // checkNoActiveCr now triggered on take_for_review (B2 fix)
  describe('B2: checkNoActiveCr triggered on take_for_review, not submit', () => {
    it('submit from DRAFT does NOT fail on wrong state check (no active-CR guard on submit)', () => {
      expect(() => call('submit', 'DRAFT', ['PROCESS_OWNER'])).not.toThrow();
    });
    it('take_for_review from REQUESTED passes role check (DB check happens separately)', () => {
      expect(() => call('take_for_review', 'REQUESTED', ['APPROVER'])).not.toThrow();
    });
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
    status: 'IN_IMPLEMENTATION',
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

  it.each(['submit', 'approve', 'submit_for_verification', 'publish'])(
    '%s: dispatches cr.notify.email job', async (action) => {
      await (svc as any).sendTransitionNotification(action, 'cr-1', baseCrAny, actor('Mario'));
      expect(crEmailQueue.add).toHaveBeenCalledWith(
        CR_NOTIFY_EMAIL_JOB,
        expect.objectContaining({ action, crId: 'cr-1' }),
      );
    },
  );

  it('submit: job payload contains actorName and crData', async () => {
    await (svc as any).sendTransitionNotification('submit', 'cr-1', baseCrAny, actor('Mario'));
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

  it.each(['take_for_review', 'cancel'])(
    '%s: does not dispatch any job', async (action) => {
      await (svc as any).sendTransitionNotification(action, 'cr-1', baseCrAny, actor('PO'));
      expect(crEmailQueue.add).not.toHaveBeenCalled();
    },
  );
});
