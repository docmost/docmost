import {
  CamelCasePlugin,
  CompiledQuery,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
} from 'kysely';
import { PageApprovalService } from './page-approval.service';

type Query = { sql: string; parameters: readonly unknown[] };

type PageFixture = {
  isBase?: boolean;
  readerVersionId?: string | null;
  settings?: unknown;
  verification?: {
    id: string;
    type: 'qms' | 'expiring';
    status?: string | null;
    source?: string;
    pendingHistoryId?: string | null;
  };
};

type Fixture = {
  pages?: Record<string, PageFixture>;
  verifiers?: {
    pageId: string;
    userId: string;
    type: 'qms' | 'expiring';
    active?: boolean;
  }[];
  users?: { id: string; active?: boolean; workspaceId?: string }[];
};

const WS = 'ws_1';
const SPACE = 'space_1';
const PAGE = { id: 'page_1', spaceId: SPACE, isBase: false };
const WRITER = '00000000-0000-7000-8000-000000000001';
const READER = '00000000-0000-7000-8000-000000000002';
const APPROVER = '00000000-0000-7000-8000-000000000003';
const ADMIN = '00000000-0000-7000-8000-000000000004';
const INACTIVE = '00000000-0000-7000-8000-000000000005';
const OTHER_WS = '00000000-0000-7000-8000-000000000006';

const approvalSpace = (approverIds: string[] = []) => ({
  approval: { enabled: true, approverIds },
});

// Kysely over a fake driver, so the SQL compiles for real and the rows are canned.
function makeDb(respond: (query: Query) => Record<string, unknown>[]) {
  const queries: Query[] = [];
  const connection = {
    executeQuery: async (compiled: CompiledQuery) => {
      const query = { sql: compiled.sql, parameters: compiled.parameters };
      queries.push(query);
      return { rows: respond(query) as any[] };
    },
    streamQuery: async function* () {},
  };
  const db = new Kysely<any>({
    dialect: {
      createAdapter: () => new PostgresAdapter(),
      createDriver: () => ({
        init: async () => {},
        acquireConnection: async () => connection,
        beginTransaction: async () => {},
        commitTransaction: async () => {},
        rollbackTransaction: async () => {},
        releaseConnection: async () => {},
        destroy: async () => {},
      }),
      createIntrospector: (kysely) => new PostgresIntrospector(kysely),
      createQueryCompiler: () => new PostgresQueryCompiler(),
    },
    plugins: [new CamelCasePlugin()],
  });
  return { db, queries };
}

function boundValue(query: Query, condition: string): unknown {
  const at = query.sql.indexOf(`${condition} $`);
  if (at < 0) return undefined;
  const index = Number(/^\$(\d+)/.exec(query.sql.slice(at + condition.length + 1))[1]);
  return query.parameters[index - 1];
}

// Answers the service's queries from the fixture, honouring the filters the SQL actually contains.
function fakeDatabase(fixture: Fixture) {
  const activeOnly = (query: Query) =>
    query.sql.includes('"deactivated_at" is null') &&
    query.sql.includes('"deleted_at" is null');

  return (query: Query): Record<string, unknown>[] => {
    if (query.sql.includes('as "verification_type"')) {
      return Object.entries(fixture.pages ?? {})
        .filter(([id]) => query.parameters.includes(id))
        .map(([id, page]) => ({
          id,
          is_base: page.isBase ?? false,
          reader_version_id: page.readerVersionId ?? null,
          verification_id: page.verification?.id ?? null,
          verification_type: page.verification?.type ?? null,
          verification_status: page.verification?.status ?? null,
          verification_source: page.verification?.source ?? null,
          pending_history_id: page.verification?.pendingHistoryId ?? null,
          space_settings: page.settings ?? null,
        }));
    }
    if (query.sql.includes('from "page_verifiers"')) {
      const type = boundValue(query, '"page_verifications"."type" =');
      return (fixture.verifiers ?? [])
        .filter((v) => query.parameters.includes(v.pageId))
        .filter((v) => type === undefined || v.type === type)
        .filter((v) => !activeOnly(query) || v.active !== false)
        .map((v) => ({ user_id: v.userId }));
    }
    if (query.sql.includes('"spaces"."workspace_id"')) {
      const page = fixture.pages?.[query.parameters[0] as string];
      return page ? [{ settings: page.settings ?? null, workspace_id: WS }] : [];
    }
    if (query.sql.includes('from "users"')) {
      const workspaceId = boundValue(query, '"workspace_id" =');
      return (fixture.users ?? [])
        .filter((u) => query.parameters.includes(u.id))
        .filter((u) => !activeOnly(query) || u.active !== false)
        .filter(
          (u) => workspaceId === undefined || (u.workspaceId ?? WS) === workspaceId,
        )
        .map((u) => ({ id: u.id }));
    }
    return [];
  };
}

type EditPermission = {
  hasAnyRestriction: boolean;
  canAccess: boolean;
  canEdit: boolean;
};

function makeService(
  opts: {
    fixture?: Fixture;
    roles?: Record<string, string>;
    editPermission?: EditPermission;
    editPermissionByUser?: Record<string, EditPermission>;
  } = {},
) {
  const { db, queries } = makeDb(fakeDatabase(opts.fixture ?? {}));
  const roles = opts.roles ?? {};
  const editPermissionFor = (userId: string): EditPermission =>
    opts.editPermissionByUser?.[userId] ??
    opts.editPermission ?? {
      hasAnyRestriction: false,
      canAccess: true,
      canEdit: true,
    };
  const spaceMemberRepo = {
    getUserSpaceRoles: jest.fn(async (userId: string) =>
      roles[userId] ? [{ userId, role: roles[userId] }] : undefined,
    ),
    getUsersSpaceRoles: jest.fn(async (userIds: string[]) =>
      userIds
        .filter((userId) => roles[userId])
        .map((userId) => ({ userId, role: roles[userId] })),
    ),
  };
  const pagePermissionRepo = {
    canUserEditPage: jest.fn(async (userId: string) => editPermissionFor(userId)),
    canUsersEditPage: jest.fn(
      async (_pageId: string, userIds: string[]) =>
        new Map(userIds.map((userId) => [userId, editPermissionFor(userId)])),
    ),
    canUserAccessPage: jest.fn(
      async (userId: string) => editPermissionFor(userId).canAccess,
    ),
    findHiddenUnpublishedAncestor: jest.fn(
      async (): Promise<string | null> => null,
    ),
  };
  const pageDraftRepo = {
    findByPageId: jest.fn(async (): Promise<any> => undefined),
    createFromPage: jest.fn(async (pageId: string, _trx?: unknown) => ({
      pageId,
    })),
    moveTitleIconToPages: jest.fn(
      async (_pageIds: string[], _trx?: unknown) => undefined,
    ),
  };
  const pageRepo = { updatePages: jest.fn(async () => ({})) };
  const service = new PageApprovalService(
    db as any,
    pagePermissionRepo as any,
    spaceMemberRepo as any,
    pageDraftRepo as any,
    {} as any,
    pageRepo as any,
  );
  return {
    service,
    queries,
    spaceMemberRepo,
    pagePermissionRepo,
    pageDraftRepo,
    pageRepo,
  };
}

describe('PageApprovalService.getState', () => {
  it('reads the page, its verification and the space settings in one query', async () => {
    const { service, queries } = makeService({
      fixture: { pages: { page_1: { settings: approvalSpace() } } },
    });

    const state = await service.getState(PAGE);

    expect(state).toMatchObject({
      controlled: true,
      source: 'space',
      unpublished: true,
      hasReaderVersion: false,
      spaceRequiresApproval: true,
    });
    expect(queries).toHaveLength(1);
    expect(queries[0].sql).toContain('"pages"."reader_version_id"');
    expect(queries[0].sql).toContain('left join "page_verifications"');
    expect(queries[0].sql).toContain('left join "spaces"');
  });

  it('reports a qms row and the reader version pointer', async () => {
    const { service } = makeService({
      fixture: {
        pages: {
          page_1: {
            readerVersionId: 'h1',
            verification: {
              id: 'v1',
              type: 'qms',
              status: 'in_approval',
              source: 'page',
              pendingHistoryId: 'h2',
            },
          },
        },
      },
    });

    expect(await service.getState(PAGE)).toEqual({
      controlled: true,
      source: 'page',
      verificationId: 'v1',
      status: 'in_approval',
      locked: true,
      hasReaderVersion: true,
      unpublished: false,
      spaceRequiresApproval: false,
      pendingHistoryId: 'h2',
      readerVersionId: 'h1',
      disabling: false,
    });
  });

  it('runs in the given transaction', async () => {
    const { service, queries } = makeService();
    const trx = makeDb(
      fakeDatabase({ pages: { page_1: { settings: approvalSpace() } } }),
    );

    const state = await service.getState(PAGE, trx.db as any);

    expect(state.controlled).toBe(true);
    expect(queries).toHaveLength(0);
    expect(trx.queries).toHaveLength(1);
  });

  it('treats a missing page as uncontrolled', async () => {
    const { service } = makeService();

    expect(await service.getState(PAGE)).toMatchObject({
      controlled: false,
      unpublished: false,
      verificationId: null,
    });
  });
});

describe('PageApprovalService.getEffectiveApproverIds', () => {
  it('ignores verifiers of an expiring row', async () => {
    const { service, queries } = makeService({
      fixture: {
        pages: {
          page_1: { verification: { id: 'v1', type: 'expiring', source: 'page' } },
        },
        verifiers: [{ pageId: 'page_1', userId: APPROVER, type: 'expiring' }],
        users: [{ id: APPROVER }],
      },
    });

    expect(await service.getEffectiveApproverIds(PAGE)).toEqual([]);
    const verifierQuery = queries.find((q) =>
      q.sql.includes('from "page_verifiers"'),
    );
    expect(boundValue(verifierQuery, '"page_verifications"."type" =')).toBe(
      'qms',
    );
  });

  it('adds active qms page verifiers to active space approvers in an approval space', async () => {
    const { service, queries } = makeService({
      fixture: {
        pages: {
          page_1: {
            settings: approvalSpace([ADMIN, INACTIVE, 'not-a-uuid', OTHER_WS]),
            verification: { id: 'v1', type: 'qms', source: 'page' },
          },
        },
        verifiers: [
          { pageId: 'page_1', userId: APPROVER, type: 'qms' },
          { pageId: 'page_1', userId: ADMIN, type: 'qms' },
          { pageId: 'page_1', userId: READER, type: 'qms', active: false },
        ],
        users: [
          { id: ADMIN },
          { id: INACTIVE, active: false },
          { id: OTHER_WS, workspaceId: 'ws_2' },
        ],
      },
    });

    expect(await service.getEffectiveApproverIds(PAGE)).toEqual([
      ADMIN,
      APPROVER,
    ]);
    const usersQuery = queries.find((q) => q.sql.includes('from "users"'));
    expect(usersQuery.parameters).not.toContain('not-a-uuid');
  });

  it('uses only qms page verifiers outside an approval space', async () => {
    const { service, queries } = makeService({
      fixture: {
        pages: {
          page_1: {
            settings: { approval: { enabled: false, approverIds: [ADMIN] } },
            verification: { id: 'v1', type: 'qms', source: 'page' },
          },
        },
        verifiers: [{ pageId: 'page_1', userId: APPROVER, type: 'qms' }],
        users: [{ id: ADMIN }],
      },
    });
    const state = await service.getState(PAGE);
    queries.length = 0;

    expect(await service.getEffectiveApproverIds(PAGE, state)).toEqual([
      APPROVER,
    ]);
    expect(queries).toHaveLength(1);
  });
});

describe('PageApprovalService.canEditPage', () => {
  const cases: Array<
    [
      string,
      string | undefined,
      { hasAnyRestriction: boolean; canAccess: boolean; canEdit: boolean },
      boolean,
    ]
  > = [
    ['space writer', 'writer', { hasAnyRestriction: false, canAccess: true, canEdit: true }, true],
    ['space admin', 'admin', { hasAnyRestriction: false, canAccess: true, canEdit: true }, true],
    ['space reader', 'reader', { hasAnyRestriction: false, canAccess: true, canEdit: true }, false],
    ['page writer on a restricted page', 'reader', { hasAnyRestriction: true, canAccess: true, canEdit: true }, true],
    ['page reader on a restricted page', 'writer', { hasAnyRestriction: true, canAccess: true, canEdit: false }, false],
    ['no access to a restricted page', 'admin', { hasAnyRestriction: true, canAccess: false, canEdit: false }, false],
    ['no space role', undefined, { hasAnyRestriction: false, canAccess: true, canEdit: true }, false],
  ];

  it.each(cases)('%s', async (_name, role, editPermission, expected) => {
    const { service, spaceMemberRepo, pagePermissionRepo } = makeService({
      roles: role ? { [WRITER]: role } : {},
      editPermission,
    });

    expect(await service.canEditPage(WRITER, PAGE)).toBe(expected);
    expect(spaceMemberRepo.getUserSpaceRoles).toHaveBeenCalledWith(
      WRITER,
      SPACE,
      { skipCache: true },
    );
    expect(pagePermissionRepo.canUserEditPage).toHaveBeenCalledWith(
      WRITER,
      PAGE.id,
      { skipCache: true },
    );
  });
});

describe('PageApprovalService.canAccessDraft', () => {
  const fixture: Fixture = {
    pages: { page_1: { settings: approvalSpace([APPROVER]) } },
    users: [{ id: APPROVER }],
  };
  const roles = { [WRITER]: 'writer', [READER]: 'reader', [APPROVER]: 'reader' };

  it('is true for a space writer', async () => {
    const { service, pagePermissionRepo } = makeService({
      fixture,
      roles,
      editPermission: { hasAnyRestriction: false, canAccess: true, canEdit: true },
    });

    expect(await service.canAccessDraft({ id: WRITER }, PAGE)).toBe(true);
    expect(pagePermissionRepo.canUserAccessPage).not.toHaveBeenCalled();
  });

  it('is false for a reader who is not an approver', async () => {
    const { service } = makeService({ fixture, roles });

    expect(await service.canAccessDraft({ id: READER }, PAGE)).toBe(false);
  });

  it('is true for a reader who is an effective approver and can access the page', async () => {
    const { service, pagePermissionRepo } = makeService({ fixture, roles });

    expect(await service.canAccessDraft({ id: APPROVER }, PAGE)).toBe(true);
    expect(pagePermissionRepo.canUserAccessPage).toHaveBeenCalledWith(
      APPROVER,
      PAGE.id,
      { skipCache: true },
    );
  });

  it('is false for an effective approver when canUserAccessPage is false', async () => {
    const { service, pagePermissionRepo } = makeService({ fixture, roles });
    pagePermissionRepo.canUserAccessPage.mockResolvedValue(false);

    expect(await service.canAccessDraft({ id: APPROVER }, PAGE)).toBe(false);
  });

  it('is false for an approver who is not a space member', async () => {
    const { service } = makeService({ fixture, roles: {} });

    expect(await service.canAccessDraft({ id: APPROVER }, PAGE)).toBe(false);
  });
});

describe('PageApprovalService.getUserIdsWithDraftAccess', () => {
  const fixture: Fixture = {
    pages: { page_1: { settings: approvalSpace([APPROVER]) } },
    users: [{ id: APPROVER }],
  };
  const unrestricted = { hasAnyRestriction: false, canAccess: true, canEdit: true };

  it('returns the writer and the reader approver, not the plain reader', async () => {
    const { service, spaceMemberRepo, pagePermissionRepo } = makeService({
      fixture,
      roles: { [WRITER]: 'writer', [READER]: 'reader', [APPROVER]: 'reader' },
    });

    expect(
      await service.getUserIdsWithDraftAccess(PAGE, [WRITER, READER, APPROVER]),
    ).toEqual([WRITER, APPROVER]);
    expect(spaceMemberRepo.getUsersSpaceRoles).toHaveBeenCalledTimes(1);
    expect(spaceMemberRepo.getUsersSpaceRoles).toHaveBeenCalledWith(
      [WRITER, READER, APPROVER],
      SPACE,
    );
    expect(pagePermissionRepo.canUsersEditPage).toHaveBeenCalledTimes(1);
    expect(pagePermissionRepo.canUsersEditPage).toHaveBeenCalledWith(PAGE.id, [
      WRITER,
      READER,
      APPROVER,
    ]);
    expect(spaceMemberRepo.getUserSpaceRoles).not.toHaveBeenCalled();
    expect(pagePermissionRepo.canUserEditPage).not.toHaveBeenCalled();
    expect(pagePermissionRepo.canUserAccessPage).not.toHaveBeenCalled();
  });

  it('runs the same queries for one candidate and for many', async () => {
    const many = Array.from(
      { length: 40 },
      (_, i) => `00000000-0000-7000-8000-1${String(i).padStart(11, '0')}`,
    );
    const run = async (candidates: string[]) => {
      const { service, queries, spaceMemberRepo, pagePermissionRepo } =
        makeService({
          fixture,
          roles: Object.fromEntries(many.map((id) => [id, 'reader'])),
        });
      expect(await service.getUserIdsWithDraftAccess(PAGE, candidates)).toEqual(
        [],
      );
      return (
        queries.length +
        spaceMemberRepo.getUsersSpaceRoles.mock.calls.length +
        pagePermissionRepo.canUsersEditPage.mock.calls.length
      );
    };

    expect(await run(many)).toBe(await run(many.slice(0, 1)));
  });

  it('applies page-level roles on restricted pages', async () => {
    const PAGE_WRITER = '00000000-0000-7000-8000-000000000007';
    const { service } = makeService({
      fixture,
      roles: {
        [WRITER]: 'writer',
        [PAGE_WRITER]: 'reader',
        [APPROVER]: 'reader',
      },
      editPermissionByUser: {
        [WRITER]: { hasAnyRestriction: true, canAccess: true, canEdit: false },
        [PAGE_WRITER]: { hasAnyRestriction: true, canAccess: true, canEdit: true },
        [APPROVER]: { hasAnyRestriction: true, canAccess: false, canEdit: false },
      },
    });

    expect(
      await service.getUserIdsWithDraftAccess(PAGE, [WRITER, PAGE_WRITER, APPROVER]),
    ).toEqual([PAGE_WRITER]);
  });

  it('drops approvers and writers who are not space members, and duplicates', async () => {
    const { service } = makeService({ fixture, roles: { [WRITER]: 'writer' } });

    expect(
      await service.getUserIdsWithDraftAccess(PAGE, [APPROVER, WRITER, WRITER]),
    ).toEqual([WRITER]);
  });

  it('is edit access on an uncontrolled page, ignoring stale qms verifiers', async () => {
    const { service } = makeService({
      fixture: {
        pages: {
          page_1: {
            isBase: true,
            verification: { id: 'v1', type: 'qms', source: 'page' },
          },
        },
        verifiers: [{ pageId: 'page_1', userId: APPROVER, type: 'qms' }],
        users: [{ id: APPROVER }],
      },
      roles: { [WRITER]: 'writer', [APPROVER]: 'reader' },
    });

    expect(
      await service.getUserIdsWithDraftAccess(PAGE, [WRITER, APPROVER]),
    ).toEqual([WRITER]);
  });

  it('skips every lookup for no candidates', async () => {
    const { service, queries, spaceMemberRepo, pagePermissionRepo } =
      makeService({ fixture });

    expect(await service.getUserIdsWithDraftAccess(PAGE, [])).toEqual([]);
    expect(queries).toHaveLength(0);
    expect(spaceMemberRepo.getUsersSpaceRoles).not.toHaveBeenCalled();
    expect(pagePermissionRepo.canUsersEditPage).not.toHaveBeenCalled();
  });

  it('uses a given state instead of reading it again', async () => {
    const { service, queries } = makeService({
      fixture,
      roles: { [APPROVER]: 'reader' },
    });
    const state = await service.getState(PAGE);
    queries.length = 0;

    expect(await service.getUserIdsWithDraftAccess(PAGE, [APPROVER], state)).toEqual([
      APPROVER,
    ]);
    expect(queries.some((q) => q.sql.includes('as "verification_type"'))).toBe(
      false,
    );
  });

  const parityCases: Array<[string, string | undefined, EditPermission, boolean]> = [
    ['space admin', 'admin', unrestricted, false],
    ['space writer', 'writer', unrestricted, false],
    ['space reader', 'reader', unrestricted, false],
    ['space reader approver', 'reader', unrestricted, true],
    ['page writer', 'reader', { hasAnyRestriction: true, canAccess: true, canEdit: true }, false],
    ['page reader writer-role', 'writer', { hasAnyRestriction: true, canAccess: true, canEdit: false }, false],
    ['page reader approver', 'reader', { hasAnyRestriction: true, canAccess: true, canEdit: false }, true],
    ['no page access approver', 'reader', { hasAnyRestriction: true, canAccess: false, canEdit: false }, true],
    ['no page access admin', 'admin', { hasAnyRestriction: true, canAccess: false, canEdit: false }, false],
    ['approver outside the space', undefined, unrestricted, true],
  ];

  it.each(parityCases)(
    'agrees with canAccessDraft: %s',
    async (_name, role, editPermission, approver) => {
      const user = approver ? APPROVER : WRITER;
      const { service } = makeService({
        fixture,
        roles: role ? { [user]: role } : {},
        editPermission,
      });

      const single = await service.canAccessDraft({ id: user }, PAGE);
      const batch = await service.getUserIdsWithDraftAccess(PAGE, [user]);

      expect(batch.includes(user)).toBe(single);
    },
  );
});

describe('PageApprovalService.isEffectiveApprover', () => {
  it('is true for a space approver and a qms verifier, false for anyone else, without permission lookups', async () => {
    const { service, spaceMemberRepo, pagePermissionRepo } = makeService({
      fixture: {
        pages: {
          page_1: {
            settings: approvalSpace([APPROVER]),
            verification: { id: 'v1', type: 'qms', source: 'page' },
          },
        },
        verifiers: [{ pageId: 'page_1', userId: ADMIN, type: 'qms' }],
        users: [{ id: APPROVER }],
      },
    });

    expect(await service.isEffectiveApprover(APPROVER, PAGE)).toBe(true);
    expect(await service.isEffectiveApprover(ADMIN, PAGE)).toBe(true);
    expect(await service.isEffectiveApprover(READER, PAGE)).toBe(false);
    expect(spaceMemberRepo.getUserSpaceRoles).not.toHaveBeenCalled();
    expect(pagePermissionRepo.canUserEditPage).not.toHaveBeenCalled();
    expect(pagePermissionRepo.canUserAccessPage).not.toHaveBeenCalled();
  });

  it('uses a given state instead of reading it again', async () => {
    const { service, queries } = makeService({
      fixture: {
        pages: { page_1: { verification: { id: 'v1', type: 'qms', source: 'page' } } },
        verifiers: [{ pageId: 'page_1', userId: APPROVER, type: 'qms' }],
      },
    });
    const state = await service.getState(PAGE);
    queries.length = 0;

    expect(await service.isEffectiveApprover(APPROVER, PAGE, state)).toBe(true);
    expect(queries).toHaveLength(1);
  });
});

describe('PageApprovalService.isWorkflowManager', () => {
  it('is false for a plain writer and true for a space admin and an effective approver', async () => {
    const { service } = makeService({
      fixture: {
        pages: { page_1: { settings: approvalSpace([APPROVER]) } },
        users: [{ id: APPROVER }],
      },
      roles: { [WRITER]: 'writer', [ADMIN]: 'admin', [APPROVER]: 'reader' },
    });

    expect(await service.isWorkflowManager({ id: WRITER }, PAGE)).toBe(false);
    expect(await service.isWorkflowManager({ id: ADMIN }, PAGE)).toBe(true);
    expect(await service.isWorkflowManager({ id: APPROVER }, PAGE)).toBe(true);
  });
});

describe('PageApprovalService.isHiddenFromUser', () => {
  it('is false without a hidden unpublished ancestor and skips the draft check', async () => {
    const { service, spaceMemberRepo, pagePermissionRepo } = makeService();

    expect(await service.isHiddenFromUser(READER, PAGE)).toBe(false);
    expect(pagePermissionRepo.findHiddenUnpublishedAncestor).toHaveBeenCalledWith(
      READER,
      PAGE.id,
    );
    expect(spaceMemberRepo.getUserSpaceRoles).not.toHaveBeenCalled();
  });

  it('is true under a hidden unpublished ancestor without draft access', async () => {
    const { service, pagePermissionRepo } = makeService({
      fixture: { pages: { page_1: { settings: approvalSpace() } } },
      roles: { [READER]: 'reader' },
    });
    pagePermissionRepo.findHiddenUnpublishedAncestor.mockResolvedValue('parent');

    expect(await service.isHiddenFromUser(READER, PAGE)).toBe(true);
  });

  it('is false under a hidden unpublished ancestor when the page draft is open to the user', async () => {
    const { service, pagePermissionRepo } = makeService({
      fixture: {
        pages: { page_1: { verification: { id: 'v1', type: 'qms', source: 'page' } } },
        verifiers: [{ pageId: 'page_1', userId: APPROVER, type: 'qms' }],
      },
      roles: { [APPROVER]: 'reader' },
    });
    pagePermissionRepo.findHiddenUnpublishedAncestor.mockResolvedValue('parent');

    expect(await service.isHiddenFromUser(APPROVER, PAGE)).toBe(false);
  });

  it('returns true for a space writer who is only a page-level reader on a restricted unpublished page', async () => {
    const { service, pagePermissionRepo } = makeService({
      fixture: { pages: { page_1: { settings: approvalSpace() } } },
      roles: { [WRITER]: 'writer' },
      editPermission: { hasAnyRestriction: true, canAccess: true, canEdit: false },
    });

    expect(await service.isHiddenFromUser(WRITER, PAGE)).toBe(true);
    expect(pagePermissionRepo.findHiddenUnpublishedAncestor).toHaveBeenCalledWith(
      WRITER,
      PAGE.id,
    );
  });

  it('returns false for a page-level writer on a restricted unpublished page', async () => {
    const { service } = makeService({
      fixture: { pages: { page_1: { settings: approvalSpace() } } },
      roles: { [READER]: 'reader' },
      editPermission: { hasAnyRestriction: true, canAccess: true, canEdit: true },
    });

    expect(await service.isHiddenFromUser(READER, PAGE)).toBe(false);
  });

  it('is false on a published page without a hidden ancestor and skips the draft check', async () => {
    const { service, spaceMemberRepo } = makeService({
      fixture: { pages: { page_1: { settings: approvalSpace(), readerVersionId: 'h1' } } },
      roles: { [READER]: 'reader' },
    });

    expect(await service.isHiddenFromUser(READER, PAGE)).toBe(false);
    expect(spaceMemberRepo.getUserSpaceRoles).not.toHaveBeenCalled();
  });

  it('uses a given state instead of reading it again', async () => {
    const { service, queries } = makeService({
      fixture: { pages: { page_1: { settings: approvalSpace() } } },
      roles: { [READER]: 'reader' },
    });
    const state = await service.getState(PAGE);
    const stateQueries = queries.length;

    expect(await service.isHiddenFromUser(READER, PAGE, state)).toBe(true);
    expect(
      queries
        .slice(stateQueries)
        .some((query) => query.sql.includes('as "verification_type"')),
    ).toBe(false);
  });
});

describe('PageApprovalService.readContentFor', () => {
  const page = {
    ...PAGE,
    title: 'Approved title',
    icon: 'A',
    content: { type: 'doc', content: [{ type: 'paragraph', text: 'APPROVED' }] },
  } as any;
  const draftContent = {
    type: 'doc',
    content: [{ type: 'paragraph', text: 'DRAFT' }],
  };

  it('returns draft content and isDraft true for a writer on a controlled page with a draft row', async () => {
    const { service, pageDraftRepo } = makeService({
      fixture: { pages: { page_1: { settings: approvalSpace(), readerVersionId: 'h1' } } },
      roles: { [WRITER]: 'writer' },
    });
    pageDraftRepo.findByPageId.mockResolvedValue({
      pageId: PAGE.id,
      title: 'Draft title',
      icon: null,
      content: draftContent,
    });

    expect(await service.readContentFor({ id: WRITER }, page)).toEqual({
      content: draftContent,
      title: 'Draft title',
      icon: 'A',
      isDraft: true,
    });
    expect(pageDraftRepo.findByPageId).toHaveBeenCalledWith(PAGE.id, {
      includeContent: true,
    });
  });

  it('returns page content and isDraft false for a reader', async () => {
    const { service, pageDraftRepo } = makeService({
      fixture: { pages: { page_1: { settings: approvalSpace(), readerVersionId: 'h1' } } },
      roles: { [READER]: 'reader' },
    });
    pageDraftRepo.findByPageId.mockResolvedValue({ content: draftContent });

    expect(await service.readContentFor({ id: READER }, page)).toEqual({
      content: page.content,
      title: 'Approved title',
      icon: 'A',
      isDraft: false,
    });
    expect(pageDraftRepo.findByPageId).not.toHaveBeenCalled();
  });

  it('returns page values on an uncontrolled page even for a writer', async () => {
    const { service, pageDraftRepo } = makeService({
      fixture: { pages: { page_1: {} } },
      roles: { [WRITER]: 'writer' },
    });

    expect(await service.readContentFor({ id: WRITER }, page)).toMatchObject({
      content: page.content,
      isDraft: false,
    });
    expect(pageDraftRepo.findByPageId).not.toHaveBeenCalled();
  });
});

describe('PageApprovalService.divertNewPages', () => {
  const cleared = {
    content: null,
    textContent: null,
    ydoc: null,
    readerVersionId: null,
  };

  it('calls createFromPage only for controlled pages without a qms row', async () => {
    const { service, pageDraftRepo, pageRepo } = makeService({
      fixture: {
        pages: {
          p_new: { settings: approvalSpace() },
          p_open: { settings: null },
          p_base: { settings: approvalSpace(), isBase: true },
          p_qms: {
            settings: approvalSpace(),
            readerVersionId: 'h1',
            verification: { id: 'v1', type: 'qms', status: 'approved', source: 'page' },
          },
        },
      },
    });

    const diverted = await service.divertNewPages([
      'p_new',
      'p_open',
      'p_base',
      'p_qms',
    ]);

    expect(diverted).toEqual(['p_new']);
    expect(pageDraftRepo.createFromPage).toHaveBeenCalledTimes(1);
    expect(pageDraftRepo.createFromPage).toHaveBeenCalledWith(
      'p_new',
      expect.anything(),
    );
    expect(pageRepo.updatePages).toHaveBeenCalledTimes(1);
    expect(pageRepo.updatePages).toHaveBeenCalledWith(
      cleared,
      ['p_new'],
      pageDraftRepo.createFromPage.mock.calls[0][1],
    );
  });

  it('diverts a page with older approved history and nulls reader_version_id', async () => {
    const { service, pageDraftRepo, pageRepo } = makeService({
      fixture: {
        pages: { p_moved: { settings: approvalSpace(), readerVersionId: 'h_old' } },
      },
    });

    expect(await service.divertNewPages(['p_moved'])).toEqual(['p_moved']);
    expect(pageDraftRepo.createFromPage).toHaveBeenCalledWith(
      'p_moved',
      expect.anything(),
    );
    expect(pageRepo.updatePages).toHaveBeenCalledWith(
      cleared,
      ['p_moved'],
      expect.anything(),
    );
  });

  it('diverts an expiring page in an approval space', async () => {
    const { service } = makeService({
      fixture: {
        pages: {
          p_expiring: {
            settings: approvalSpace(),
            verification: { id: 'v1', type: 'expiring', source: 'page' },
          },
        },
      },
    });

    expect(await service.divertNewPages(['p_expiring'])).toEqual(['p_expiring']);
  });

  it('runs in the caller transaction', async () => {
    const { service, queries, pageDraftRepo, pageRepo } = makeService();
    const trx = makeDb(
      fakeDatabase({ pages: { p_new: { settings: approvalSpace() } } }),
    );

    await service.divertNewPages(['p_new', 'p_new'], trx.db as any);

    expect(queries).toHaveLength(0);
    expect(trx.queries).toHaveLength(1);
    expect(pageDraftRepo.createFromPage).toHaveBeenCalledTimes(1);
    expect(pageDraftRepo.createFromPage).toHaveBeenCalledWith('p_new', trx.db);
    expect(pageRepo.updatePages).toHaveBeenCalledWith(cleared, ['p_new'], trx.db);
  });

  it('does nothing when no page qualifies', async () => {
    const { service, queries, pageDraftRepo, pageRepo } = makeService({
      fixture: { pages: { p_open: {} } },
    });

    expect(await service.divertNewPages([])).toEqual([]);
    expect(queries).toHaveLength(0);
    expect(await service.divertNewPages(['p_open'])).toEqual([]);
    expect(pageDraftRepo.createFromPage).not.toHaveBeenCalled();
    expect(pageDraftRepo.moveTitleIconToPages).not.toHaveBeenCalled();
    expect(pageRepo.updatePages).not.toHaveBeenCalled();
  });

  it('folds draft title and icon overrides into the diverted pages once their drafts exist', async () => {
    const { service, pageDraftRepo } = makeService({
      fixture: {
        pages: {
          p_moved: { settings: approvalSpace(), readerVersionId: 'h_old' },
          p_new: { settings: approvalSpace() },
          p_qms: {
            settings: approvalSpace(),
            readerVersionId: 'h1',
            verification: { id: 'v1', type: 'qms', status: 'approved', source: 'page' },
          },
        },
      },
    });

    await service.divertNewPages(['p_qms', 'p_new', 'p_moved']);

    const trx = pageDraftRepo.createFromPage.mock.calls[0][1];
    expect(pageDraftRepo.moveTitleIconToPages).toHaveBeenCalledTimes(1);
    expect(pageDraftRepo.moveTitleIconToPages).toHaveBeenCalledWith(
      ['p_moved', 'p_new'],
      trx,
    );
    const lastCreate = Math.max(
      ...pageDraftRepo.createFromPage.mock.invocationCallOrder,
    );
    expect(
      pageDraftRepo.moveTitleIconToPages.mock.invocationCallOrder[0],
    ).toBeGreaterThan(lastCreate);
  });
});

describe('PageApprovalService.convertExpiringToSpaceControl', () => {
  it('turns expiring rows of the given pages into space approval rows without verifiers', async () => {
    const { service, queries } = makeService();
    const trx = makeDb((query) =>
      query.sql.startsWith('update "page_verifications"')
        ? [{ id: 'v_expiring' }]
        : [],
    );

    expect(
      await service.convertExpiringToSpaceControl(['p1', 'p2'], trx.db as any),
    ).toEqual(['v_expiring']);

    expect(queries).toHaveLength(0);
    expect(trx.queries).toHaveLength(2);
    const [update, remove] = trx.queries;
    expect(update.sql).toMatch(/^update "page_verifications" set /);
    for (const column of [
      'mode',
      'period_amount',
      'period_unit',
      'verified_at',
      'verified_by_id',
      'expires_at',
      'data',
    ]) {
      expect(boundValue(update, `"${column}" =`)).toBeNull();
    }
    expect(boundValue(update, 'set "type" =')).toBe('qms');
    expect(boundValue(update, '"source" =')).toBe('space');
    expect(boundValue(update, '"status" =')).toBe('draft');
    expect(update.sql).toContain('where "page_id" in');
    expect(update.parameters).toEqual(expect.arrayContaining(['p1', 'p2']));
    expect(boundValue(update, 'and "type" =')).toBe('expiring');
    expect(remove.sql).toMatch(/^delete from "page_verifiers" where "page_verification_id" in/);
    expect(remove.parameters).toEqual(['v_expiring']);
  });

  it('touches nothing for no pages and skips the verifier delete when nothing converted', async () => {
    const { service } = makeService();
    const trx = makeDb(() => []);

    expect(await service.convertExpiringToSpaceControl([], trx.db as any)).toEqual([]);
    expect(trx.queries).toHaveLength(0);
    expect(
      await service.convertExpiringToSpaceControl(['p1'], trx.db as any),
    ).toEqual([]);
    expect(trx.queries).toHaveLength(1);
  });
});

describe('PageApprovalService.findSpaceControlledPageIds', () => {
  it('returns non-base pages without a page-sourced qms row, in the caller transaction', async () => {
    const { service, queries } = makeService();
    const trx = makeDb(
      fakeDatabase({
        pages: {
          p_none: { settings: approvalSpace() },
          p_space: {
            settings: approvalSpace(),
            verification: { id: 'v1', type: 'qms', source: 'space' },
          },
          p_expiring: {
            settings: approvalSpace(),
            verification: { id: 'v2', type: 'expiring', source: 'page' },
          },
          p_page: {
            settings: approvalSpace(),
            verification: { id: 'v3', type: 'qms', source: 'page' },
          },
          p_base: { settings: approvalSpace(), isBase: true },
        },
      }),
    );

    const ids = await service.findSpaceControlledPageIds(
      ['p_none', 'p_space', 'p_expiring', 'p_page', 'p_base'],
      trx.db as any,
    );

    expect(ids.sort()).toEqual(['p_expiring', 'p_none', 'p_space']);
    expect(queries).toHaveLength(0);
    expect(trx.queries).toHaveLength(1);
  });

  it('runs no query for no pages', async () => {
    const { service, queries } = makeService();
    expect(await service.findSpaceControlledPageIds([])).toEqual([]);
    expect(queries).toHaveLength(0);
  });
});
