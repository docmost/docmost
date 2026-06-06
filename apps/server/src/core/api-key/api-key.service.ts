import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiKeyRepo } from '@docmost/db/repos/api-key/api-key.repo';
import { UserRepo } from '@docmost/db/repos/user/user.repo';
import { WorkspaceRepo } from '@docmost/db/repos/workspace/workspace.repo';
import { TokenService } from '../auth/services/token.service';
import { JwtApiKeyPayload } from '../auth/dto/jwt-payload';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { CreateApiKeyDto, UpdateApiKeyDto } from './dto/api-key.dto';
import { isUserDisabled } from '../../common/helpers';

// Keys without an explicit expiry are still JWTs; sign them long-lived so the
// "never expires" UX holds in practice (DB expiresAt stays null).
const NON_EXPIRING_API_KEY_TTL = '3650d';

@Injectable()
export class ApiKeyService {
  constructor(
    private readonly apiKeyRepo: ApiKeyRepo,
    private readonly userRepo: UserRepo,
    private readonly workspaceRepo: WorkspaceRepo,
    private readonly tokenService: TokenService,
  ) {}

  async createApiKey(user: User, workspaceId: string, dto: CreateApiKeyDto) {
    let expiresAt: Date | null = null;
    if (dto.expiresAt) {
      expiresAt = new Date(dto.expiresAt);
      if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
        throw new BadRequestException('expiresAt must be a valid future date');
      }
    }

    const apiKey = await this.apiKeyRepo.insertApiKey({
      name: dto.name,
      creatorId: user.id,
      workspaceId,
      expiresAt,
    });

    const expiresIn = expiresAt
      ? Math.floor((expiresAt.getTime() - Date.now()) / 1000)
      : NON_EXPIRING_API_KEY_TTL;

    const token = await this.tokenService.generateApiToken({
      apiKeyId: apiKey.id,
      user,
      workspaceId,
      expiresIn,
    });

    // token is returned only once, at creation time
    return { ...apiKey, token };
  }

  async getApiKeys(
    workspaceId: string,
    pagination: PaginationOptions,
    opts?: { creatorId?: string },
  ) {
    return this.apiKeyRepo.getApiKeysPaginated(workspaceId, pagination, opts);
  }

  async updateApiKey(
    workspaceId: string,
    dto: UpdateApiKeyDto,
    opts?: { creatorId?: string },
  ) {
    const existing = await this.apiKeyRepo.findById(dto.apiKeyId, workspaceId);
    if (!existing) {
      throw new NotFoundException('API key not found');
    }
    if (opts?.creatorId && existing.creatorId !== opts.creatorId) {
      throw new ForbiddenException();
    }

    await this.apiKeyRepo.updateApiKey(
      { name: dto.name },
      dto.apiKeyId,
      workspaceId,
    );

    return this.apiKeyRepo.findById(dto.apiKeyId, workspaceId, {
      includeCreator: true,
    });
  }

  async revokeApiKey(
    workspaceId: string,
    apiKeyId: string,
    opts?: { creatorId?: string },
  ) {
    const existing = await this.apiKeyRepo.findById(apiKeyId, workspaceId);
    if (!existing) {
      throw new NotFoundException('API key not found');
    }
    if (opts?.creatorId && existing.creatorId !== opts.creatorId) {
      throw new ForbiddenException();
    }
    await this.apiKeyRepo.softDelete(apiKeyId, workspaceId);
  }

  /**
   * Resolves an API_KEY JWT into its owning user + workspace.
   * Called by JwtStrategy. Mirrors the ACCESS-token return shape.
   */
  async validateApiKey(
    payload: JwtApiKeyPayload,
  ): Promise<{ user: User; workspace: Workspace }> {
    const apiKey = await this.apiKeyRepo.findActiveById(payload.apiKeyId);
    if (!apiKey || apiKey.workspaceId !== payload.workspaceId) {
      throw new UnauthorizedException('Invalid API key');
    }
    if (
      apiKey.expiresAt &&
      new Date(apiKey.expiresAt).getTime() <= Date.now()
    ) {
      throw new UnauthorizedException('API key expired');
    }

    const workspace = await this.workspaceRepo.findById(payload.workspaceId);
    if (!workspace) {
      throw new UnauthorizedException();
    }

    const user = await this.userRepo.findById(payload.sub, payload.workspaceId);
    if (!user || isUserDisabled(user)) {
      throw new UnauthorizedException();
    }

    // best-effort audit of last usage; never block auth on this
    this.apiKeyRepo.updateLastUsed(apiKey.id).catch(() => undefined);

    return { user, workspace };
  }
}
