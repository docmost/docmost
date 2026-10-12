import {
  Connection,
  Extension,
  Hocuspocus,
  onAuthenticatePayload,
  onConfigurePayload,
} from '@hocuspocus/server';
import { Forbidden } from '@hocuspocus/common';
import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { RedisService } from '@nestjs-labs/nestjs-ioredis';
import type { Redis } from 'ioredis';
import { TokenService } from '../../core/auth/services/token.service';
import { UserRepo } from '@docmost/db/repos/user/user.repo';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import { PagePermissionRepo } from '@docmost/db/repos/page/page-permission.repo';
import { UserSessionRepo } from '@docmost/db/repos/session/user-session.repo';
import { findHighestUserSpaceRole } from '@docmost/db/repos/space/utils';
import { Page, User } from '@docmost/db/types/entity.types';
import { SpaceRole } from '../../common/helpers/types/permission';
import { isUserDisabled } from '../../common/helpers';
import { CacheKey } from '../../common/helpers/cache-keys';
import { getPageId } from '../collaboration.util';
import { COLLAB_ACCESS_RECHECK_CHANNEL } from '../constants';
import { CollabAccessRecheck } from '../services/collab-access.service';
import { JwtCollabPayload, JwtType } from '../../core/auth/dto/jwt-payload';

type CollabAccess = 'none' | 'read' | 'write';

@Injectable()
export class AuthenticationExtension implements Extension {
  private readonly logger = new Logger(AuthenticationExtension.name);
  private instance: Hocuspocus;
  private subscriber: Redis;

  constructor(
    private tokenService: TokenService,
    private userRepo: UserRepo,
    private pageRepo: PageRepo,
    private readonly spaceMemberRepo: SpaceMemberRepo,
    private readonly pagePermissionRepo: PagePermissionRepo,
    private readonly redisService: RedisService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly userSessionRepo: UserSessionRepo,
  ) {}

  async onConfigure({ instance }: onConfigurePayload) {
    this.instance = instance;
    this.subscriber = this.redisService.getOrThrow().duplicate();
    this.subscriber.on('error', () => {});
    this.subscriber.on('message', async (_channel, message) => {
      try {
        await this.recheckAccess(JSON.parse(message));
      } catch (err) {
        this.logger.error({ err }, 'Failed to recheck collab access');
      }
    });
    await this.subscriber.subscribe(COLLAB_ACCESS_RECHECK_CHANNEL);
  }

  async onDestroy() {
    this.subscriber?.disconnect();
  }

  async onAuthenticate(data: onAuthenticatePayload) {
    const { documentName, token } = data;
    const pageId = getPageId(documentName);

    let jwtPayload: JwtCollabPayload;

    try {
      jwtPayload = await this.tokenService.verifyJwt(token, JwtType.COLLAB);
    } catch (error) {
      throw new UnauthorizedException('Invalid collab token');
    }

    const userId = jwtPayload.sub;
    const workspaceId = jwtPayload.workspaceId;

    const user = await this.userRepo.findById(userId, workspaceId);

    if (!user) {
      throw new UnauthorizedException();
    }

    if (isUserDisabled(user)) {
      throw new UnauthorizedException();
    }

    // tokens issued before sessions were embedded carry no sessionId
    if (
      jwtPayload.sessionId &&
      !(await this.isSessionActive(jwtPayload.sessionId, userId, workspaceId))
    ) {
      throw new UnauthorizedException();
    }

    const page = await this.pageRepo.findById(pageId);
    if (!page) {
      this.logger.debug(`Page not found: ${pageId}`);
      throw new NotFoundException('Page not found');
    }

    const access = await this.getFreshAccess(user, page);

    if (access === 'none') {
      this.logger.warn(`User ${user.id} not authorized to access page: ${pageId}`);
      throw new UnauthorizedException();
    }

    if (access === 'read') {
      data.connectionConfig.readOnly = true;
    }

    this.logger.debug(`Authenticated user ${user.id} on page ${pageId}`);

    return {
      user,
      sessionId: jwtPayload.sessionId,
    };
  }

  async recheckAccess({
    userIds = [],
    pageIds = [],
  }: CollabAccessRecheck): Promise<void> {
    if (!this.instance?.documents.size) return;

    const recheckUserIds = new Set(userIds);
    const recheckPageIds = new Set<string>();
    for (const pageId of pageIds) {
      const pages = await this.pageRepo.getPageAndDescendants(pageId, {
        includeContent: false,
      });
      pages.forEach((page) => recheckPageIds.add(page.id));
    }

    for (const document of this.instance.documents.values()) {
      const pageId = getPageId(document.name);
      const connections = document.getConnections().filter((connection) => {
        const userId = connection.context?.user?.id;
        return (
          userId && (recheckPageIds.has(pageId) || recheckUserIds.has(userId))
        );
      });
      if (connections.length === 0) continue;

      for (const connection of connections) {
        try {
          await this.recheckConnection(connection, pageId);
        } catch (err) {
          this.logger.error(
            { err },
            `Failed to recheck collab access on ${document.name}`,
          );
        }
      }
    }
  }

  private async recheckConnection(
    connection: Connection,
    pageId: string,
  ): Promise<void> {
    const { id, workspaceId } = connection.context.user;
    const sessionId: string | undefined = connection.context.sessionId;
    const [user, page, sessionActive] = await Promise.all([
      this.userRepo.findById(id, workspaceId),
      this.pageRepo.findById(pageId),
      !sessionId || this.isSessionActive(sessionId, id, workspaceId),
    ]);

    let access: CollabAccess = 'none';
    if (user && !isUserDisabled(user) && page && sessionActive) {
      access = await this.getFreshAccess(user, page);
    }

    if (access === 'write' || (access === 'read' && connection.readOnly)) {
      return;
    }

    connection.sendStateless(JSON.stringify({ type: 'page.permissions' }));
    if (access === 'none') {
      connection.close(Forbidden);
    } else {
      connection.readOnly = true;
    }
  }

  private async isSessionActive(
    sessionId: string,
    userId: string,
    workspaceId: string,
  ): Promise<boolean> {
    const session = await this.userSessionRepo.findActiveById(sessionId);
    return session?.userId === userId && session?.workspaceId === workspaceId;
  }

  private async getFreshAccess(user: User, page: Page): Promise<CollabAccess> {
    // permission lookups are cached for a few seconds and can predate a revocation
    await Promise.all([
      this.cacheManager.del(CacheKey.SPACE_ROLES(user.id, page.spaceId)),
      this.cacheManager.del(CacheKey.PAGE_CAN_EDIT(user.id, page.id)),
    ]).catch((err) =>
      this.logger.warn({ err }, 'Failed to clear cached page permissions'),
    );
    return this.getAccess(user, page);
  }

  private async getAccess(user: User, page: Page): Promise<CollabAccess> {
    const userSpaceRole = findHighestUserSpaceRole(
      await this.spaceMemberRepo.getUserSpaceRoles(user.id, page.spaceId),
    );
    if (!userSpaceRole) return 'none';

    const { hasAnyRestriction, canAccess, canEdit } =
      await this.pagePermissionRepo.canUserEditPage(user.id, page.id);
    if (hasAnyRestriction && !canAccess) return 'none';

    const canWrite = hasAnyRestriction
      ? canEdit
      : userSpaceRole !== SpaceRole.READER;
    return canWrite && !page.deletedAt ? 'write' : 'read';
  }
}
