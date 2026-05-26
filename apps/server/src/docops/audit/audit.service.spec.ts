import { Test } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { KYSELY_MODULE_CONNECTION_TOKEN } from 'nestjs-kysely';
import { AuditService } from './audit.service';

const buildDbMock = () => {
  const mock: any = {
    insertInto: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue([]),
    executeTakeFirst: jest.fn().mockResolvedValue({ count: 0 }),
    selectFrom: jest.fn().mockReturnThis(),
    selectAll: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    fn: { countAll: jest.fn().mockReturnValue({ as: jest.fn().mockReturnValue('count') }) },
    executeQuery: jest.fn().mockResolvedValue({ rows: [] }),
  };
  return mock;
};

const buildModule = async (db: any) => {
  const module = await Test.createTestingModule({
    providers: [
      AuditService,
      { provide: KYSELY_MODULE_CONNECTION_TOKEN(), useValue: db },
    ],
  }).compile();
  return module.get(AuditService);
};

describe('AuditService — log()', () => {
  it('inserts a row into docops_audit_logs with all fields', async () => {
    const db = buildDbMock();
    const svc = await buildModule(db);

    await svc.log({
      actorId: 'user-1',
      action: 'cr.approve',
      entityKind: 'change_request',
      entityId: 'cr-1',
      payloadDiff: { fromStatus: 'IN_REVIEW', toStatus: 'APPROVED' },
      ip: '127.0.0.1',
      userAgent: 'test-agent',
    });

    expect(db.insertInto).toHaveBeenCalledWith('docops_audit_logs');
    expect(db.values).toHaveBeenCalledWith(
      expect.objectContaining({
        actor_id: 'user-1',
        action: 'cr.approve',
        entity_kind: 'change_request',
        entity_id: 'cr-1',
        ip: '127.0.0.1',
        user_agent: 'test-agent',
      }),
    );
    expect(db.execute).toHaveBeenCalled();
  });

  it('uses null actorId when not provided', async () => {
    const db = buildDbMock();
    const svc = await buildModule(db);

    await svc.log({ action: 'http.POST', entityKind: 'service', entityId: 'svc-1' });

    expect(db.values).toHaveBeenCalledWith(
      expect.objectContaining({ actor_id: null }),
    );
  });
});

describe('AuditService — listLogs()', () => {
  it('throws ForbiddenException when user has no ADMIN role', async () => {
    const db = buildDbMock();
    const svc = await buildModule(db);
    jest.spyOn(svc as any, 'assertAdmin').mockRejectedValue(new ForbiddenException('Admin role required'));

    await expect(
      svc.listLogs({ limit: 10, offset: 0 }, { id: 'user-1' } as any),
    ).rejects.toThrow(ForbiddenException);
  });

  it('returns items and total when user is ADMIN', async () => {
    const db = buildDbMock();
    db.execute = jest.fn().mockResolvedValue([
      {
        id: 1,
        action: 'cr.approve',
        entity_kind: 'change_request',
        entity_id: 'cr-1',
        created_at: new Date().toISOString(),
      },
    ]);
    db.executeTakeFirst = jest.fn().mockResolvedValue({ count: 1 });
    const svc = await buildModule(db);
    jest.spyOn(svc as any, 'assertAdmin').mockResolvedValue(undefined);

    const result = await svc.listLogs({ limit: 10, offset: 0 }, { id: 'admin-1' } as any);

    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].action).toBe('cr.approve');
  });

  it('applies actorId filter when provided', async () => {
    const db = buildDbMock();
    const svc = await buildModule(db);
    jest.spyOn(svc as any, 'assertAdmin').mockResolvedValue(undefined);

    await svc.listLogs({ actorId: 'user-99', limit: 10, offset: 0 }, { id: 'admin-1' } as any);

    expect(db.where).toHaveBeenCalledWith(
      'al.actor_id',
      '=',
      'user-99',
    );
  });
});
