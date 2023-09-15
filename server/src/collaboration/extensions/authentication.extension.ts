import { Extension, onAuthenticatePayload } from '@hocuspocus/server';
import { UserService } from '../../core/user/user.service';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { TokenService } from '../../core/auth/services/token.service';

@Injectable()
export class AuthenticationExtension implements Extension {
  constructor(
    private tokenService: TokenService,
    private userService: UserService,
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
    const user = await this.userService.findById(userId);

    //TODO: Check if the page exists and verify user permissions for page.
    // if all fails, abort connection

    return {
      user,
    };
  }
}
