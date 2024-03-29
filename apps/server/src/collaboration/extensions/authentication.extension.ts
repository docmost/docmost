import { Extension, onAuthenticatePayload } from '@hocuspocus/server';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { TokenService } from '../../core/auth/services/token.service';
import { UserRepo } from '@docmost/db/repos/user/user.repo';

@Injectable()
export class AuthenticationExtension implements Extension {
  constructor(
    private tokenService: TokenService,
    private userRepo: UserRepo,
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

    //TODO: Check if the page exists and verify user permissions for page.
    // if all fails, abort connection

    return {
      user,
    };
  }
}
