import { Extension, onAuthenticatePayload } from '@hocuspocus/server';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { TokenService } from '../../core/auth/services/token.service';
import { UserRepo } from '@docmost/db/repos/user/user.repo';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import { findHighestUserSpaceRole } from '@docmost/db/repos/space/utils';
import { SpaceRole } from '../../helpers/types/permission';

@Injectable()
export class AuthenticationExtension implements Extension {
  constructor(
    private tokenService: TokenService,
    private userRepo: UserRepo,
    private pageRepo: PageRepo,
    private readonly spaceMemberRepo: SpaceMemberRepo,
  ) {}

  async onAuthenticate(data: onAuthenticatePayload) {
    const { documentName, token } = data;

    let jwtPayload = null;

    try {
      jwtPayload = await this.tokenService.verifyJwt(token);
    } catch (error) {
      throw new UnauthorizedException('Could not verify jwt token');
    }

    const userId = jwtPayload.sub;
    const workspaceId = jwtPayload.workspaceId;

    const user = await this.userRepo.findById(userId, workspaceId);

    if (!user) {
      throw new UnauthorizedException();
    }

    const page = await this.pageRepo.findById(documentName);
    if (!page) {
      throw new UnauthorizedException('Page not found');
    }

    const userSpaceRoles = await this.spaceMemberRepo.getUserSpaceRoles(
      user.id,
      page.spaceId,
    );

    const userSpaceRole = findHighestUserSpaceRole(userSpaceRoles);

    if (!userSpaceRole) {
      throw new UnauthorizedException();
    }

    if (userSpaceRole === SpaceRole.READER) {
      data.connection.readOnly = true;
    }

    return {
      user,
    };
  }
}
