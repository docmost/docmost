import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { ScimTokenRepo } from '../scim/scim-token.repo';

@Injectable()
export class ScimAuthGuard implements CanActivate {
  constructor(private readonly scimTokenRepo: ScimTokenRepo) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const auth = req.headers?.authorization as string | undefined;
    if (!auth?.startsWith('Bearer ')) {
      throw new UnauthorizedException('SCIM bearer token required');
    }
    const raw = auth.slice('Bearer '.length).trim();
    const tokenHash = createHash('sha256').update(raw).digest('hex');
    const token = await this.scimTokenRepo.findByTokenHash(tokenHash);
    if (!token) {
      throw new UnauthorizedException('Invalid SCIM token');
    }
    await this.scimTokenRepo.touchLastUsed(token.id);
    req.scimWorkspaceId = token.workspaceId;
    return true;
  }
}
