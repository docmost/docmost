import { Extension, onAuthenticatePayload } from '@hocuspocus/server';
import {
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { TokenService } from '../../core/auth/services/token.service';
import { UserRepo } from '@docmost/db/repos/user/user.repo';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import { PagePermissionRepo } from '@docmost/db/repos/page/page-permission.repo';
import { findHighestUserSpaceRole } from '@docmost/db/repos/space/utils';
import { SpaceRole } from '../../common/helpers/types/permission';
import { getPageId } from '../collaboration.util';
import { JwtCollabPayload, JwtType } from '../../core/auth/dto/jwt-payload';

@Injectable()
export class AuthenticationExtension implements Extension {
  private readonly logger = new Logger(AuthenticationExtension.name);

  constructor(
    private tokenService: TokenService,
    private userRepo: UserRepo,
    private pageRepo: PageRepo,
    private readonly spaceMemberRepo: SpaceMemberRepo,
    private readonly pagePermissionRepo: PagePermissionRepo,
  ) {}

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

    if (user.deactivatedAt || user.deletedAt) {
      throw new UnauthorizedException();
    }

    const page = await this.pageRepo.findById(pageId);
    if (!page) {
      this.logger.warn(`Page not found: ${pageId}`);
      throw new NotFoundException('Page not found');
    }

    const userSpaceRoles = await this.spaceMemberRepo.getUserSpaceRoles(
      user.id,
      page.spaceId,
    );

    const userSpaceRole = findHighestUserSpaceRole(userSpaceRoles);

    if (!userSpaceRole) {
      this.logger.warn(`User not authorized to access page: ${pageId}`);
      throw new UnauthorizedException();
    }

    if (userSpaceRole === SpaceRole.READER) {
      data.connection.readOnly = true;
      this.logger.debug(`User granted readonly access to page: ${pageId}`);
    }

    // Check page-level permissions (in addition to space permissions)
    const canAccessPage = await this.pagePermissionRepo.canUserAccessPage(
      user.id,
      page.id,
    );

    if (!canAccessPage) {
      this.logger.warn(
        `User ${user.id} denied page-level access to page: ${pageId}`,
      );
      throw new UnauthorizedException();
    }

    // Check if user can edit (has writer role on all restricted ancestors)
    const canEditPage = await this.pagePermissionRepo.canUserEditPage(
      user.id,
      page.id,
    );

    // If user has space edit permission but lacks page-level write permission, force readonly
    if (!canEditPage && !data.connection.readOnly) {
      data.connection.readOnly = true;
      this.logger.debug(
        `User ${user.id} granted readonly access to restricted page: ${pageId}`,
      );
    }

    this.logger.debug(`Authenticated user ${user.id} on page ${pageId}`);

    return {
      user,
    };
  }
}
