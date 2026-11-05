import { AsyncLocalStorage } from 'async_hooks';
import { NotFoundException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { defer, lastValueFrom } from 'rxjs';
import {
  CamelCasePlugin,
  CompiledQuery,
  DummyDriver,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
} from 'kysely';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import { SpaceRepo } from '@docmost/db/repos/space/space.repo';
import SpaceAbilityFactory from './space-ability.factory';
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from '../interfaces/space-ability.type';
import { PageAccessService } from '../../page/page-access/page-access.service';
import { PageController } from '../../page/page.controller';
import { SearchController } from '../../search/search.controller';
import { SpaceController } from '../../space/space.controller';
import { IntegrationCallerInterceptor } from '../../../common/interceptors/integration-caller.interceptor';
import { SpaceRole } from '../../../common/helpers/types/permission';
import { JwtType } from '../../auth/dto/jwt-payload';

const user = { id: 'user-1' } as any;
const workspace = { id: 'ws-1' } as any;
const page = { id: 'page-1', spaceId: 'space-1' } as any;
const pagination = Object.assign(new PaginationOptions(), { limit: 20 });

const countOf = (sql: string, needle: string) => sql.split(needle).length - 1;

function buildBoundary(opts: { archived?: boolean } = {}) {
  const cls = new ClsService(new AsyncLocalStorage());
  const interceptor = new IntegrationCallerInterceptor(cls);

  const queries: CompiledQuery[] = [];
  const db = new Kysely<any>({
    dialect: {
      createAdapter: () => new PostgresAdapter(),
      createDriver: () => new DummyDriver(),
      createIntrospector: (kysely) => new PostgresIntrospector(kysely),
      createQueryCompiler: () => new PostgresQueryCompiler(),
    },
    plugins: [new CamelCasePlugin()],
    log: (event) => {
      if (event.level === 'query') queries.push(event.query);
    },
  });

  const spaceRepo = new SpaceRepo(db as any, {} as any);
  const isArchived = jest
    .spyOn(spaceRepo, 'isArchived')
    .mockResolvedValue(opts.archived ?? true);
  const spaceMemberRepo = new SpaceMemberRepo(
    db as any,
    {} as any,
    spaceRepo,
    {} as any,
    cls,
  );
  const getUserSpaceRoles = jest
    .spyOn(spaceMemberRepo, 'getUserSpaceRoles')
    .mockResolvedValue([{ userId: user.id, role: SpaceRole.ADMIN }]);
  const pagePermissionRepo = {
    canUserAccessPage: jest.fn().mockResolvedValue(true),
    canUserEditPage: jest.fn().mockResolvedValue({
      hasAnyRestriction: false,
      canAccess: true,
      canEdit: true,
    }),
  };

  const spaceAbility = new SpaceAbilityFactory(spaceMemberRepo, spaceRepo, cls);
  const pageAccess = new PageAccessService(
    pagePermissionRepo as any,
    spaceAbility,
    spaceRepo,
  );

  const spaceController = new SpaceController(
    {
      getSpaceInfo: jest
        .fn()
        .mockResolvedValue({ id: 'space-1', name: 'Archive' }),
    } as any,
    {} as any,
    spaceMemberRepo,
    spaceAbility,
    {} as any,
    spaceRepo,
  );
  const pageController = new PageController(
    {} as any,
    { findById: jest.fn().mockResolvedValue(page) } as any,
    {} as any,
    spaceAbility,
    pageAccess,
    {} as any,
    {} as any,
    {} as any,
  );
  const searchController = new SearchController(
    { searchPage: jest.fn().mockResolvedValue({ items: [] }) } as any,
    spaceAbility,
    { getSearchDriver: () => 'database' } as any,
    {} as any,
    {} as any,
    {} as any,
  );

  // Runs a handler the way Nest does: request context first, then the interceptor, then the handler.
  const asCaller = <T>(authType: JwtType, handler: () => Promise<T>) =>
    cls.run(() =>
      lastValueFrom<T>(
        interceptor.intercept(
          {
            getType: () => 'http',
            switchToHttp: () => ({
              getRequest: () => ({ user: { authType } }),
            }),
          } as any,
          { handle: () => defer(handler) },
        ),
      ),
    );

  return {
    asCaller,
    queries,
    isArchived,
    getUserSpaceRoles,
    pagePermissionRepo,
    spaceAbility,
    pageAccess,
    spaceMemberRepo,
    spaceController,
    pageController,
    searchController,
  };
}

type Boundary = ReturnType<typeof buildBoundary>;

const otherCallers: [string, JwtType][] = [
  ['an API key', JwtType.API_KEY],
  ['an app session', JwtType.ACCESS],
];

describe('integration boundary for archived spaces', () => {
  describe('space abilities', () => {
    it('treats an archived space as missing for an OAuth token, even with a cached admin role', async () => {
      const { asCaller, spaceAbility, getUserSpaceRoles } = buildBoundary();

      await expect(
        asCaller(JwtType.OAUTH_ACCESS, () =>
          spaceAbility.createForUser(user, 'space-1'),
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(getUserSpaceRoles).not.toHaveBeenCalled();
    });

    it.each(otherCallers)(
      'lets %s into an archived space',
      async (_name, authType) => {
        const { asCaller, spaceAbility } = buildBoundary();

        const ability = await asCaller(authType, () =>
          spaceAbility.createForUser(user, 'space-1'),
        );

        expect(
          ability.can(SpaceCaslAction.Manage, SpaceCaslSubject.Settings),
        ).toBe(true);
      },
    );

    it('lets an OAuth token into an active space', async () => {
      const { asCaller, spaceAbility } = buildBoundary({ archived: false });

      const ability = await asCaller(JwtType.OAUTH_ACCESS, () =>
        spaceAbility.createForUser(user, 'space-1'),
      );

      expect(
        ability.can(SpaceCaslAction.Manage, SpaceCaslSubject.Settings),
      ).toBe(true);
    });

    it('does not mark work that runs outside a request', async () => {
      const { spaceAbility, isArchived } = buildBoundary();

      const ability = await spaceAbility.createForUser(user, 'space-1');

      expect(
        ability.can(SpaceCaslAction.Manage, SpaceCaslSubject.Settings),
      ).toBe(true);
      expect(isArchived).not.toHaveBeenCalled();
    });
  });

  describe('page access', () => {
    it('refuses a page in an archived space for an OAuth token', async () => {
      const { asCaller, pageAccess, pagePermissionRepo } = buildBoundary();

      await expect(
        asCaller(JwtType.OAUTH_ACCESS, () =>
          pageAccess.validateCanView(page, user),
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(pagePermissionRepo.canUserAccessPage).not.toHaveBeenCalled();
    });

    it.each(otherCallers)(
      'lets %s view a page in an archived space',
      async (_name, authType) => {
        const { asCaller, pageAccess } = buildBoundary();

        await expect(
          asCaller(authType, () => pageAccess.validateCanView(page, user)),
        ).resolves.toBeUndefined();
      },
    );
  });

  describe('endpoints that check a space', () => {
    const endpoints: [string, (boundary: Boundary) => Promise<unknown>][] = [
      [
        'spaces/info',
        ({ spaceController }) =>
          spaceController.getSpaceInfo(
            { spaceId: 'space-1' } as any,
            user,
            workspace,
          ),
      ],
      [
        'pages/info',
        ({ pageController }) =>
          pageController.getPage({ pageId: 'page-1' } as any, user),
      ],
      [
        'search scoped to a space',
        ({ searchController }) =>
          searchController.pageSearch(
            { query: 'plan', spaceId: 'space-1' } as any,
            user,
            workspace,
          ),
      ],
    ];

    describe.each(endpoints)('%s', (_name, call) => {
      it('answers not found to an OAuth token for an archived space', async () => {
        const boundary = buildBoundary();

        await expect(
          boundary.asCaller(JwtType.OAUTH_ACCESS, () => call(boundary)),
        ).rejects.toBeInstanceOf(NotFoundException);
      });

      it.each(otherCallers)(
        'still serves %s for an archived space',
        async (_name, authType) => {
          const boundary = buildBoundary();

          await expect(
            boundary.asCaller(authType, () => call(boundary)),
          ).resolves.toBeDefined();
        },
      );
    });
  });

  describe('space list', () => {
    it('gives an OAuth token no archived spaces, even when it asks for them', async () => {
      const { asCaller, spaceMemberRepo, queries } = buildBoundary();

      await asCaller(JwtType.OAUTH_ACCESS, () =>
        spaceMemberRepo.getUserSpaces(user.id, pagination, { archived: true }),
      );

      // both membership branches hold only active spaces, so the archived-only filter on top matches nothing
      const { sql } = queries[0];
      expect(countOf(sql, '"spaces"."archived_at" is null')).toBe(2);
      expect(sql).toContain(') and "archived_at" is not null');
    });

    it('lists active spaces for an OAuth token', async () => {
      const { asCaller, spaceMemberRepo, queries } = buildBoundary();

      await asCaller(JwtType.OAUTH_ACCESS, () =>
        spaceMemberRepo.getUserSpaces(user.id, pagination),
      );

      const { sql } = queries[0];
      expect(countOf(sql, '"spaces"."archived_at" is null')).toBe(2);
      expect(sql).toContain(') and "archived_at" is null');
    });

    it.each(otherCallers)(
      'still lists archived spaces for %s',
      async (_name, authType) => {
        const { asCaller, spaceMemberRepo, queries } = buildBoundary();

        await asCaller(authType, () =>
          spaceMemberRepo.getUserSpaces(user.id, pagination, {
            archived: true,
          }),
        );

        const { sql } = queries[0];
        expect(sql).not.toContain('"spaces"."archived_at" is null');
        expect(sql).toContain(') and "archived_at" is not null');
      },
    );
  });
});
