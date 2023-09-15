import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { EnvironmentService } from '../../../environment/environment.service';
import { User } from '../../user/entities/user.entity';
import { FastifyRequest } from 'fastify';
import { TokensDto } from '../dto/tokens.dto';

@Injectable()
export class TokenService {
  constructor(
    private jwtService: JwtService,
    private environmentService: EnvironmentService,
  ) {}
  async generateJwt(user: User): Promise<string> {
    const payload = {
      sub: user.id,
      email: user.email,
    };
    return await this.jwtService.signAsync(payload);
  }

  async generateTokens(user: User): Promise<TokensDto> {
    return {
      accessToken: await this.generateJwt(user),
      refreshToken: null,
    };
  }

  async verifyJwt(token: string) {
    return await this.jwtService.verifyAsync(token, {
      secret: this.environmentService.getJwtSecret(),
    });
  }

  async extractTokenFromHeader(
    request: FastifyRequest,
  ): Promise<string | undefined> {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
