import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JwtType } from '../../core/auth/dto/jwt-payload';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any) {
    if (err || !user || user.authType !== JwtType.ACCESS) return null;
    return user;
  }
}
