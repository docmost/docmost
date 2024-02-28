import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { TokenService } from '../services/token.service';
import { UserService } from '../../user/user.service';

@Injectable()
export class JwtGuard implements CanActivate {
  constructor(
    private tokenService: TokenService,
    private userService: UserService,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token: string = await this.tokenService.extractTokenFromHeader(
      request,
    );

    if (!token) {
      throw new UnauthorizedException('Invalid jwt token');
    }

    try {
      const payload = await this.tokenService.verifyJwt(token);

      //fetch user and current workspace data from db
      request['user'] = await this.userService.getUserInstance(payload.sub);
    } catch (error) {
      throw new UnauthorizedException('Could not verify jwt token');
    }

    return true;
  }
}
