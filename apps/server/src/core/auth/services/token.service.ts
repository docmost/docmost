import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { EnvironmentService } from '../../../integrations/environment/environment.service';
import { User } from '../../user/entities/user.entity';
import { TokensDto } from '../dto/tokens.dto';
import { JwtPayload, JwtRefreshPayload, JwtType } from '../dto/jwt-payload';

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

  async generateRefreshToken(userId: string, workspaceId): Promise<string> {
    const payload: JwtRefreshPayload = {
      sub: userId,
      workspaceId,
      type: JwtType.REFRESH,
    };
    const expiresIn = '30d'; // todo: fix
    return this.jwtService.sign(payload, { expiresIn });
  }

  async generateTokens(user: User): Promise<TokensDto> {
    return {
      accessToken: await this.generateAccessToken(user),
      refreshToken: await this.generateRefreshToken(user.id, user.workspaceId),
    };
  }

  async verifyJwt(token: string) {
    return this.jwtService.verifyAsync(token, {
      secret: this.environmentService.getJwtSecret(),
    });
  }
}
