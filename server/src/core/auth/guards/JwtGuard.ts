import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { TokenService } from '../services/token.service';

@Injectable()
export class JwtGuard implements CanActivate {
  constructor(private tokenService: TokenService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token: string = await this.tokenService.extractTokenFromHeader(
      request,
    );

    if (!token) {
      throw new UnauthorizedException('Invalid jwt token');
    }

    try {
      request['user'] = await this.tokenService.verifyJwt(token);
    } catch (error) {
      throw new UnauthorizedException('Could not verify jwt token');
    }

    return true;
  }
}
