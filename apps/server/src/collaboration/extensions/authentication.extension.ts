import {
  Connection,
  Extension,
  Hocuspocus,
  onAuthenticatePayload,
  onConfigurePayload,
} from '@hocuspocus/server';
import { Forbidden } from '@hocuspocus/common';
import {
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { RedisService } from '@nestjs-labs/nestjs-ioredis';
import type { Redis } from 'ioredis';
import { TokenService } from '../../core/auth/services/token.service';
import { UserRepo } from '@docmost/db/repos/user/user.repo';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import { PagePermissionRepo } from '@docmost/db/repos/page/page-permission.repo';
import { findHighestUserSpaceRole } from '@docmost/db/repos/space/utils';
import { Page, User } from '@docmost/db/types/entity.types';
import { SpaceRole } from '../../common/helpers/types/permission';
import { isUserDisabled } from '../../common/helpers';
import {
  CollabAccess,
  getPageId,
  isValidPageDocumentName,
  resolveCollabAccess,
} from '../collaboration.util';
import { COLLAB_ACCESS_RECHECK_CHANNEL } from '../constants';
import { CollabAccessRecheck } from '../services/collab-access.service';
import { JwtCollabPayload, JwtType } from '../../core/auth/dto/jwt-payload';
import { PageApprovalService } from '../../core/page/approval/page-approval.service';

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
    private readonly pageApprovalService: PageApprovalService,
    private readonly redisService: RedisService,
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
    // resubscribe on every ready, ioredis never replays a SUBSCRIBE that failed while redis was down
    this.subscriber.on('ready', () => {
      this.subscriber
        .subscribe(COLLAB_ACCESS_RECHECK_CHANNEL)
        .catch((err) =>
          this.logger.error({ err }, 'Failed to subscribe to collab rechecks'),
        );
    });
  }

  async onDestroy() {
    this.subscriber?.disconnect();
  }

  async onAuthenticate(data: onAuthenticatePayload) {
    const { documentName, token } = data;
    if (!isValidPageDocumentName(documentName)) {
      throw new UnauthorizedException('Invalid document name');
    }
    const pageId = getPageId(documentName);

    let jwtPayload: JwtCollabPayload;

    try {
      jwtPayload = await this.tokenService.verifyJwt(token, JwtType.COLLAB);
    } catch (error) {
      throw new UnauthorizedException('Invalid collab token');
    }

    const userId = jwtPayload.sub;
    const workspaceId = jwtPayload.workspaceId;

    const [user, page] = await Promise.all([
      this.userRepo.findById(userId, workspaceId),
      this.pageRepo.findById(pageId),
    ]);

    if (!user || isUserDisabled(user)) {
      throw new UnauthorizedException();
    }

    if (!page || page.workspaceId !== workspaceId) {
      this.logger.debug(`Page not found: ${pageId}`);
      throw new NotFoundException('Page not found');
    }

    const access = await this.getAccess(user, page);

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
    };
  }

  async recheckAccess({
    userIds = [],
    pageIds = [],
    spaceIds = [],
  }: CollabAccessRecheck): Promise<void> {
    if (!this.instance?.documents.size) return;

    const recheckUserIds = new Set(userIds);
    const recheckPageIds = await this.findRecheckPageIds(pageIds, spaceIds);

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

  private async findRecheckPageIds(
    pageIds: string[],
    spaceIds: string[],
  ): Promise<Set<string>> {
    const recheckPageIds = new Set<string>();
    for (const pageId of pageIds) {
      const pages = await this.pageRepo.getPageAndDescendants(pageId, {
        includeContent: false,
      });
      pages.forEach((page) => recheckPageIds.add(page.id));
    }

    if (spaceIds.length > 0) {
      const recheckSpaceIds = new Set(spaceIds);
      const openPageIds = [...this.instance.documents.keys()]
        .filter(isValidPageDocumentName)
        .map(getPageId);
      const openPages = await this.pageRepo.findManyByIds(openPageIds);
      openPages
        .filter((page) => recheckSpaceIds.has(page.spaceId))
        .forEach((page) => recheckPageIds.add(page.id));
    }

    return recheckPageIds;
  }

  private async recheckConnection(
    connection: Connection,
    pageId: string,
  ): Promise<void> {
    const { id, workspaceId } = connection.context.user;
    const [user, page] = await Promise.all([
      this.userRepo.findById(id, workspaceId),
      this.pageRepo.findById(pageId),
    ]);

    let access: CollabAccess = 'none';
    if (user && !isUserDisabled(user) && page) {
      access = await this.getAccess(user, page);
    }

    if (access === 'write' || (access === 'read' && connection.readOnly)) {
      return;
    }

    connection.sendStateless(
      JSON.stringify({ type: 'page.permissions', access }),
    );
    connection.readOnly = true;
    if (access === 'none') {
      connection.close(Forbidden);
    }
  }

  // a connection outlives this check, so it must not see a stale cached allow
  private async getAccess(user: User, page: Page): Promise<CollabAccess> {
    const [spaceRoles, { hasAnyRestriction, canAccess, canEdit }, state] =
      await Promise.all([
        this.spaceMemberRepo.getUserSpaceRoles(user.id, page.spaceId, {
          skipCache: true,
        }),
        this.pagePermissionRepo.canUserEditPage(user.id, page.id, {
          skipCache: true,
        }),
        this.pageApprovalService.getState(page),
      ]);

    const userSpaceRole = findHighestUserSpaceRole(spaceRoles);
    const restrictedNoAccess = hasAnyRestriction && !canAccess;
    const canView = !!userSpaceRole && !restrictedNoAccess;
    const canWrite = hasAnyRestriction
      ? canEdit
      : userSpaceRole !== SpaceRole.READER;
    // the resolver denies users who cannot view, so the approval lookups skip them
    const canAccessDraft =
      canView &&
      (canWrite ||
        (state.controlled &&
          (await this.pageApprovalService.isEffectiveApprover(
            user.id,
            page,
            state,
          ))));
    // draft access to the page itself means it is never hidden
    const hidden =
      canView &&
      !canAccessDraft &&
      (await this.pageApprovalService.isHiddenFromUser(user.id, page, state));

    return resolveCollabAccess({
      hasSpaceRole: !!userSpaceRole,
      restrictedNoAccess,
      canWrite,
      deleted: !!page.deletedAt,
      controlled: state.controlled,
      canAccessDraft,
      locked: state.locked,
      hidden,
    });
  }
}
