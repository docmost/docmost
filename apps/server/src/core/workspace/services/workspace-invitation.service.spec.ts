import {
  CamelCasePlugin,
  CompiledQuery,
  DummyDriver,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
} from 'kysely';
import { addDays } from 'date-fns';
import { AuditEvent } from '../../../common/events/audit-events';
import { WorkspaceInvitationService } from './workspace-invitation.service';

const WORKSPACE = { id: 'ws_1', hostname: 'acme' } as any;

// answers selects on workspace_invitations with `invitation`, the invitation insert with `insertedRow`, everything else with no rows
function buildService(
  invitation?: Record<string, unknown>,
  insertedRow?: Record<string, unknown>,
) {
  const queries: CompiledQuery[] = [];
  const driver = new DummyDriver();
  driver.acquireConnection = async () =>
    ({
      executeQuery: async (query: CompiledQuery) => ({
        rows:
          invitation &&
          query.sql.startsWith('select') &&
          query.sql.includes('from "workspace_invitations"')
            ? [invitation]
            : insertedRow &&
                query.sql.startsWith('insert into "workspace_invitations"')
              ? [insertedRow]
              : [],
      }),
      streamQuery: async function* () {},
    }) as any;
  const db = new Kysely<any>({
    dialect: {
      createAdapter: () => new PostgresAdapter(),
      createDriver: () => driver,
      createIntrospector: (kysely) => new PostgresIntrospector(kysely),
      createQueryCompiler: () => new PostgresQueryCompiler(),
    },
    plugins: [new CamelCasePlugin()],
    log: (event) => {
      if (event.level === 'query') queries.push(event.query);
    },
  });
  const userRepo = { findById: jest.fn().mockResolvedValue({ name: 'Grace' }) };
  const domainService = { getUrl: () => 'https://acme.example.com' };
  const auditService = { log: jest.fn() };
  const mailService = { sendToQueue: jest.fn() };
  const service = new WorkspaceInvitationService(
    userRepo as any,
    {} as any,
    mailService as any,
    domainService as any,
    {} as any,
    {} as any,
    db as any,
    {} as any,
    {} as any,
    auditService as any,
  );
  return { service, queries, auditService, mailService };
}

function collectText(node: any): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return `${node}`;
  if (Array.isArray(node)) return node.map(collectText).join('');
  return collectText(node.props?.children);
}

function expiredInvitation() {
  return {
    id: 'inv_1',
    email: 'ada@example.com',
    role: 'member',
    token: 'invite-token',
    group_ids: null,
    invited_by_id: 'user_1',
    message: null,
    workspace_id: 'ws_1',
    created_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
    expires_at: new Date(Date.now() - 60_000),
  };
}

function liveInvitation() {
  return { ...expiredInvitation(), expires_at: addDays(new Date(), 1) };
}

function expectSevenDaysAhead(value: unknown) {
  expect(value).toBeInstanceOf(Date);
  const drift = (value as Date).getTime() - addDays(new Date(), 7).getTime();
  expect(Math.abs(drift)).toBeLessThan(5_000);
}

describe('WorkspaceInvitationService expiry', () => {
  it('refuses to accept an expired invitation even with the right token', async () => {
    const { service } = buildService(expiredInvitation());

    await expect(
      service.acceptInvitation(
        {
          invitationId: 'inv_1',
          token: 'invite-token',
          name: 'Ada',
          password: 'correct-horse',
        },
        WORKSPACE,
      ),
    ).rejects.toThrow('Invitation has expired');
  });

  it('does not show an expired invitation on the signup page', async () => {
    const { service } = buildService(expiredInvitation());

    await expect(
      service.getInvitationById('inv_1', WORKSPACE),
    ).rejects.toThrow('Invitation has expired');
  });

  it('issues a new token when copying the link of an expired invitation', async () => {
    const { service, queries, auditService } = buildService(expiredInvitation());

    const link = await service.getInvitationLinkById('inv_1', WORKSPACE);

    const [update] = queries.filter((q) => q.sql.startsWith('update'));
    const newToken = update.parameters[0];
    expect(newToken).toEqual(expect.any(String));
    expect(newToken).not.toBe('invite-token');
    expectSevenDaysAhead(update.parameters[1]);
    expect(link).toBe(
      `https://acme.example.com/invites/inv_1?token=${newToken}`,
    );
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        event: AuditEvent.WORKSPACE_INVITE_RESENT,
        metadata: expect.objectContaining({ source: 'copy_link' }),
      }),
    );
  });

  it('leaves a live invitation untouched when copying its link', async () => {
    const { service, queries, auditService } = buildService(liveInvitation());

    const link = await service.getInvitationLinkById('inv_1', WORKSPACE);

    expect(queries.filter((q) => q.sql.startsWith('update'))).toEqual([]);
    expect(link).toBe(
      'https://acme.example.com/invites/inv_1?token=invite-token',
    );
    expect(auditService.log).not.toHaveBeenCalled();
  });

  it('keeps the token when resending a live invitation', async () => {
    const { service, queries } = buildService(liveInvitation());
    const sendInvitationMail = jest
      .spyOn(service, 'sendInvitationMail')
      .mockResolvedValue(undefined);

    await service.resendInvitation('inv_1', WORKSPACE);

    const [update] = queries.filter((q) => q.sql.startsWith('update'));
    expect(update.sql).toBe(
      'update "workspace_invitations" set "token" = $1, "expires_at" = $2, "updated_at" = $3 where "id" = $4',
    );
    expect(update.parameters[0]).toBe('invite-token');
    expectSevenDaysAhead(update.parameters[1]);
    expect(sendInvitationMail).toHaveBeenCalledWith(
      'inv_1',
      'ada@example.com',
      'invite-token',
      'Grace',
      'acme',
      null,
    );
  });

  it('issues a new token when resending an expired invitation', async () => {
    const { service, queries } = buildService(expiredInvitation());
    const sendInvitationMail = jest
      .spyOn(service, 'sendInvitationMail')
      .mockResolvedValue(undefined);

    await service.resendInvitation('inv_1', WORKSPACE);

    const [update] = queries.filter((q) => q.sql.startsWith('update'));
    const newToken = update.parameters[0];
    expect(newToken).toEqual(expect.any(String));
    expect(newToken).not.toBe('invite-token');
    expectSevenDaysAhead(update.parameters[1]);
    expect(sendInvitationMail).toHaveBeenCalledWith(
      'inv_1',
      'ada@example.com',
      newToken,
      'Grace',
      'acme',
      null,
    );
  });

  it('sets an expiry on new invitations and renews expired ones with a new token on re-invite', async () => {
    const { service, queries } = buildService();

    await service.createInvitation(
      { emails: ['ada@example.com'], role: 'member', groupIds: [] },
      WORKSPACE,
      { id: 'user_1', role: 'admin', name: 'Grace' } as any,
    );

    const [insert] = queries.filter((q) => q.sql.startsWith('insert'));
    expect(insert.sql).toBe(
      'insert into "workspace_invitations" ("email", "role", "token", "workspace_id", "invited_by_id", "group_ids", "expires_at", "message") values ($1, $2, $3, $4, $5, $6, $7, $8) ' +
        'on conflict ("email", "workspace_id") do update set "role" = "excluded"."role", "token" = "excluded"."token", "group_ids" = "excluded"."group_ids", "invited_by_id" = "excluded"."invited_by_id", "expires_at" = "excluded"."expires_at", "message" = "excluded"."message", "updated_at" = $9 ' +
        'where "workspace_invitations"."expires_at" < $10 returning *',
    );
    expectSevenDaysAhead(insert.parameters[6]);
  });

  it('stores the message without links', async () => {
    const { service, queries } = buildService();
    const authUser = { id: 'user_1', role: 'admin', name: 'Grace' } as any;

    await service.createInvitation(
      {
        emails: ['ada@example.com'],
        role: 'member',
        groupIds: [],
        message: 'Join us at https://evil.com today',
      },
      WORKSPACE,
      authUser,
    );
    await service.createInvitation(
      {
        emails: ['ada@example.com'],
        role: 'member',
        groupIds: [],
        message: 'https://evil.com',
      },
      WORKSPACE,
      authUser,
    );

    const [first, second] = queries.filter((q) => q.sql.startsWith('insert'));
    expect(first.parameters[7]).toBe('Join us at today');
    expect(second.parameters[7]).toBeNull();
  });

  it('resends the stored message', async () => {
    const { service } = buildService({
      ...liveInvitation(),
      message: 'Welcome aboard',
    });
    const sendInvitationMail = jest
      .spyOn(service, 'sendInvitationMail')
      .mockResolvedValue(undefined);

    await service.resendInvitation('inv_1', WORKSPACE);

    expect(sendInvitationMail).toHaveBeenCalledWith(
      'inv_1',
      'ada@example.com',
      'invite-token',
      'Grace',
      'acme',
      'Welcome aboard',
    );
  });

  it('sends and audits the sanitized message on create', async () => {
    const { service, auditService } = buildService(undefined, {
      ...liveInvitation(),
      message: 'Join us at today',
    });
    const sendInvitationMail = jest
      .spyOn(service, 'sendInvitationMail')
      .mockResolvedValue(undefined);

    await service.createInvitation(
      {
        emails: ['ada@example.com'],
        role: 'member',
        groupIds: [],
        message: 'Join us at https://evil.com today',
      },
      WORKSPACE,
      { id: 'user_1', role: 'admin', name: 'Grace' } as any,
    );

    expect(sendInvitationMail).toHaveBeenCalledWith(
      'inv_1',
      'ada@example.com',
      'invite-token',
      'Grace',
      'acme',
      'Join us at today',
    );
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        event: AuditEvent.WORKSPACE_INVITE_CREATED,
        changes: {
          after: expect.objectContaining({ message: 'Join us at today' }),
        },
      }),
    );
  });

  it('removes links from the inviter name in the email body only', async () => {
    const { service, mailService } = buildService();

    await service.sendInvitationMail(
      'inv_1',
      'ada@example.com',
      'invite-token',
      'IT Help it-help@evil.com',
      'acme',
      'Hi',
    );

    const [mail] = mailService.sendToQueue.mock.calls[0];
    const text = collectText(mail.template);
    expect(text).toContain('IT Help');
    expect(text).not.toContain('evil.com');
    expect(text).toContain('Hi');
    expect(mail.subject).toBe('IT Help it-help@evil.com invited you to Docmost');
  });

  it('records the message when revoking an invitation', async () => {
    const { service, auditService } = buildService({
      ...liveInvitation(),
      message: 'Welcome aboard',
    });

    await service.revokeInvitation('inv_1', 'ws_1');

    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        event: AuditEvent.WORKSPACE_INVITE_REVOKED,
        changes: {
          before: {
            email: 'ada@example.com',
            role: 'member',
            message: 'Welcome aboard',
          },
        },
      }),
    );
  });

  it('proposes a repeated email only once so the upsert can run', async () => {
    const { service, queries } = buildService();

    await service.createInvitation(
      {
        emails: ['ada@example.com', 'ada@example.com'],
        role: 'member',
        groupIds: [],
      },
      WORKSPACE,
      { id: 'user_1', role: 'admin', name: 'Grace' } as any,
    );

    const [insert] = queries.filter((q) => q.sql.startsWith('insert'));
    expect(
      insert.parameters.filter((value) => value === 'ada@example.com'),
    ).toHaveLength(1);
  });
});
