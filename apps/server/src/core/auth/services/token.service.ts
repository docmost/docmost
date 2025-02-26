import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { EnvironmentService } from '../../../integrations/environment/environment.service';
import { JwtCollabPayload, JwtPayload, JwtType } from '../dto/jwt-payload';
import { User } from '@docmost/db/types/entity.types';

@Injectable()
export class TokenService {
  constructor(
    private jwtService: JwtService,
    private environmentService: EnvironmentService,
  ) {}

  async generateAccessToken(user: User): Promise<string> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      workspaceId: user.workspaceId,
      type: JwtType.ACCESS,
    };
    return this.jwtService.sign(payload);
  }

  async generateCollabToken(
    userId: string,
    workspaceId: string,
  ): Promise<string> {
    const payload: JwtCollabPayload = {
      sub: userId,
      workspaceId,
      type: JwtType.COLLAB,
    };
    const expiresIn = '24h';
    return this.jwtService.sign(payload, { expiresIn });
  }

  async verifyJwt(token: string) {
    return this.jwtService.verifyAsync(token, {
      secret: this.environmentService.getAppSecret(),
    });
  }
}
