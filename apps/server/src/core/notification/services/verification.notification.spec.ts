import {
  CamelCasePlugin,
  CompiledQuery,
  DatabaseConnection,
  DummyDriver,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  QueryResult,
} from 'kysely';
import { VerificationNotificationService } from './verification.notification';
import { NotificationType } from '../notification.constants';

const VERIFICATION_ID = '019a5f00-0000-7000-8000-000000000001';
const PAGE_ID = '019a5f00-0000-7000-8000-000000000002';
const SPACE_ID = '019a5f00-0000-7000-8000-000000000003';
const WORKSPACE_ID = '019a5f00-0000-7000-8000-000000000004';
const ALICE = '019a5f00-0000-7000-8000-000000000005';
const BOB = '019a5f00-0000-7000-8000-000000000006';
const APP_URL = 'https://docs.example.com';
const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

type Row = Record<string, unknown>;

type SentNotice = {
  userId: string;
  type: string;
  data?: { expiresAt: string };
  createdAt: Date;
};

const NOTICE_FILTERS: Array<
  [RegExp, (notice: SentNotice, value: unknown) => boolean]
> = [
  [
    /^"page_verification_id" = \$(\d+)$/,
    (_, value) => value === VERIFICATION_ID,
  ],
  [/^"type" = \$(\d+)$/, (notice, value) => notice.type === value],
  [
    /^data->>'expiresAt' = \$(\d+)$/,
    (notice, value) => notice.data?.expiresAt === value,
  ],
  [
    /^"created_at" >= \$(\d+)$/,
    (notice, value) =>
      notice.createdAt.getTime() >= new Date(value as Date).getTime(),
  ],
];

function selectNotices(query: CompiledQuery, notices: SentNotice[]): Row[] {
  const clauses = query.sql.split(' where ')[1].split(' and ');
  const matchers = clauses.map((clause) => {
    const filter = NOTICE_FILTERS.find(([pattern]) => pattern.test(clause));
    if (!filter) throw new Error(`Unexpected notification filter: ${clause}`);
    const [pattern, matches] = filter;
    const value = query.parameters[Number(clause.match(pattern)[1]) - 1];
    return (notice: SentNotice) => matches(notice, value);
  });
  return notices
    .filter((notice) => matchers.every((match) => match(notice)))
    .map((notice) => ({ user_id: notice.userId }));
}

class FakeDriver extends DummyDriver {
  constructor(private readonly answer: (query: CompiledQuery) => Row[]) {
    super();
  }

  async acquireConnection(): Promise<DatabaseConnection> {
    const answer = this.answer;
    return {
      async executeQuery<R>(query: CompiledQuery): Promise<QueryResult<R>> {
        return { rows: answer(query) as R[] };
      },
      streamQuery() {
        throw new Error('Not used');
      },
    };
  }
}

function setup({
  verification,
  verifierIds = [ALICE],
  notices = [],
}: {
  verification: Row;
  verifierIds?: string[];
  notices?: SentNotice[];
}) {
  const answer = (query: CompiledQuery): Row[] => {
    if (query.sql.includes('from "page_verifications"')) {
      return [
        {
          id: VERIFICATION_ID,
          page_id: PAGE_ID,
          space_id: SPACE_ID,
          workspace_id: WORKSPACE_ID,
          type: 'expiring',
          ...verification,
        },
      ];
    }
    if (query.sql.includes('from "page_verifiers"')) {
      return verifierIds.map((userId) => ({ user_id: userId }));
    }
    if (query.sql.includes('from "notifications"')) {
      return selectNotices(query, notices);
    }
    if (query.sql.includes('from "pages"')) {
      return [{ id: PAGE_ID, title: 'Runbook', slug_id: 'runbook' }];
    }
    if (query.sql.includes('from "spaces"')) {
      return [{ id: SPACE_ID, slug: 'ops', name: 'Ops' }];
    }
    throw new Error(`Unexpected query: ${query.sql}`);
  };

  const db = new Kysely<any>({
    dialect: {
      createAdapter: () => new PostgresAdapter(),
      createDriver: () => new FakeDriver(answer),
      createIntrospector: (kysely) => new PostgresIntrospector(kysely),
      createQueryCompiler: () => new PostgresQueryCompiler(),
    },
    plugins: [new CamelCasePlugin()],
  });
  const notificationService = {
    create: jest.fn(async (data: { userId: string }) => ({
      id: `notification-${data.userId}`,
    })),
    queueEmail: jest.fn(async () => undefined),
  };
  const spaceMemberRepo = {
    getUserIdsWithSpaceAccess: jest.fn(
      async (userIds: string[]) => new Set(userIds),
    ),
  };
  const pagePermissionRepo = {
    getUserIdsWithPageAccess: jest.fn(
      async (_pageId: string, userIds: string[]) => userIds,
    ),
  };

  const service = new VerificationNotificationService(
    db as any,
    notificationService as any,
    spaceMemberRepo as any,
    pagePermissionRepo as any,
  );
  const notifiedUserIds = () =>
    notificationService.create.mock.calls.map(([data]) => data.userId);

  return { service, notifiedUserIds };
}

describe('VerificationNotificationService', () => {
  describe('re-verify soon notices', () => {
    it('notifies again when a later cycle has a new expiry date', async () => {
      const previousExpiresAt = new Date(Date.now() - 28 * DAY);
      const { service, notifiedUserIds } = setup({
        verification: {
          verified_at: previousExpiresAt,
          expires_at: new Date(previousExpiresAt.getTime() + 30 * DAY),
        },
        notices: [
          {
            userId: ALICE,
            type: NotificationType.PAGE_VERIFICATION_EXPIRING,
            data: { expiresAt: previousExpiresAt.toISOString() },
            createdAt: new Date(previousExpiresAt.getTime() - 4 * DAY),
          },
        ],
      });

      await service.processVerificationExpiring(
        { verificationId: VERIFICATION_ID },
        APP_URL,
      );

      expect(notifiedUserIds()).toEqual([ALICE]);
    });

    it('skips verifiers already told about this expiry date', async () => {
      const expiresAt = new Date(Date.now() + 2 * DAY);
      const { service, notifiedUserIds } = setup({
        verification: {
          verified_at: new Date(expiresAt.getTime() - 30 * DAY),
          expires_at: expiresAt,
        },
        verifierIds: [ALICE, BOB],
        notices: [
          {
            userId: ALICE,
            type: NotificationType.PAGE_VERIFICATION_EXPIRING,
            data: { expiresAt: expiresAt.toISOString() },
            createdAt: new Date(expiresAt.getTime() - 4 * DAY),
          },
        ],
      });

      await service.processVerificationExpiring(
        { verificationId: VERIFICATION_ID },
        APP_URL,
      );

      expect(notifiedUserIds()).toEqual([BOB]);
    });

    it('does not repeat after a re-verify that keeps a fixed expiry date', async () => {
      const expiresAt = new Date(Date.now() + 2 * DAY);
      const { service, notifiedUserIds } = setup({
        verification: {
          mode: 'fixed',
          verified_at: new Date(Date.now() - MINUTE),
          expires_at: expiresAt,
        },
        notices: [
          {
            userId: ALICE,
            type: NotificationType.PAGE_VERIFICATION_EXPIRING,
            data: { expiresAt: expiresAt.toISOString() },
            createdAt: new Date(expiresAt.getTime() - 4 * DAY),
          },
        ],
      });

      await service.processVerificationExpiring(
        { verificationId: VERIFICATION_ID },
        APP_URL,
      );

      expect(notifiedUserIds()).toEqual([]);
    });

    it('deduplicates a page that was never verified', async () => {
      const expiresAt = new Date(Date.now() + 2 * DAY);
      const { service, notifiedUserIds } = setup({
        verification: { verified_at: null, expires_at: expiresAt },
        notices: [
          {
            userId: ALICE,
            type: NotificationType.PAGE_VERIFICATION_EXPIRING,
            data: { expiresAt: expiresAt.toISOString() },
            createdAt: new Date(expiresAt.getTime() - 4 * DAY),
          },
        ],
      });

      await service.processVerificationExpiring(
        { verificationId: VERIFICATION_ID },
        APP_URL,
      );

      expect(notifiedUserIds()).toEqual([]);
    });
  });

  describe('expired notices', () => {
    it('notifies again when a later cycle expires', async () => {
      const expiresAt = new Date(Date.now() - 60 * MINUTE);
      const verifiedAt = new Date(expiresAt.getTime() - 30 * DAY);
      const { service, notifiedUserIds } = setup({
        verification: { verified_at: verifiedAt, expires_at: expiresAt },
        notices: [
          {
            userId: ALICE,
            type: NotificationType.PAGE_VERIFICATION_EXPIRED,
            createdAt: new Date(verifiedAt.getTime() - DAY),
          },
        ],
      });

      await service.processVerificationExpired(
        { verificationId: VERIFICATION_ID },
        APP_URL,
      );

      expect(notifiedUserIds()).toEqual([ALICE]);
    });

    it('skips verifiers already told since it expired', async () => {
      const expiresAt = new Date(Date.now() - 60 * MINUTE);
      const { service, notifiedUserIds } = setup({
        verification: {
          verified_at: new Date(expiresAt.getTime() - 30 * DAY),
          expires_at: expiresAt,
        },
        verifierIds: [ALICE, BOB],
        notices: [
          {
            userId: ALICE,
            type: NotificationType.PAGE_VERIFICATION_EXPIRED,
            createdAt: new Date(expiresAt.getTime() + MINUTE),
          },
        ],
      });

      await service.processVerificationExpired(
        { verificationId: VERIFICATION_ID },
        APP_URL,
      );

      expect(notifiedUserIds()).toEqual([BOB]);
    });
  });
});
