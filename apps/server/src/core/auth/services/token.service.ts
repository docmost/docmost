import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { EnvironmentService } from '../../../integrations/environment/environment.service';
import {
  JwtAttachmentPayload,
  JwtCollabPayload,
  JwtExchangePayload,
  JwtPayload,
  JwtType,
} from '../dto/jwt-payload';
import { User } from '@docmost/db/types/entity.types';

@Injectable()
export class TokenService {
  constructor(
    private jwtService: JwtService,
    private environmentService: EnvironmentService,
  ) {}

  async generateAccessToken(user: User): Promise<string> {
    if (user.deletedAt) {
      throw new ForbiddenException();
    }

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

  async generateExchangeToken(
    userId: string,
    workspaceId: string,
  ): Promise<string> {
    const payload: JwtExchangePayload = {
      sub: userId,
      workspaceId: workspaceId,
      type: JwtType.EXCHANGE,
    };
    return this.jwtService.sign(payload, { expiresIn: '10s' });
  }

  async generateAttachmentToken(opts: {
    attachmentId: string;
    pageId: string;
    workspaceId: string;
  }): Promise<string> {
    const { attachmentId, pageId, workspaceId } = opts;
    const payload: JwtAttachmentPayload = {
      attachmentId: attachmentId,
      pageId: pageId,
      workspaceId: workspaceId,
      type: JwtType.ATTACHMENT,
    };
    return this.jwtService.sign(payload, { expiresIn: '1h' });
  }

  async verifyJwt(token: string, tokenType: string) {
    const payload = await this.jwtService.verifyAsync(token, {
      secret: this.environmentService.getAppSecret(),
    });

    if (payload.type !== tokenType) {
      throw new UnauthorizedException(
        'Invalid JWT token. Token type does not match.',
      );
    }

    return payload;
  }
}
