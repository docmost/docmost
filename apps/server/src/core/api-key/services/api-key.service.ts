import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiKeyRepo } from '@docmost/db/repos/api-key/api-key.repo';
import { UserRepo } from '@docmost/db/repos/user/user.repo';
import { WorkspaceRepo } from '@docmost/db/repos/workspace/workspace.repo';
import { TokenService } from '../../auth/services/token.service';
import { JwtApiKeyPayload } from '../../auth/dto/jwt-payload';
import { ApiKey, User, Workspace } from '@docmost/db/types/entity.types';

@Injectable()
export class ApiKeyService {
  constructor(
    private apiKeyRepo: ApiKeyRepo,
    private userRepo: UserRepo,
    private workspaceRepo: WorkspaceRepo,
    private tokenService: TokenService,
  ) {}

  async validateApiKey(
    payload: JwtApiKeyPayload,
  ): Promise<{ user: User; workspace: Workspace }> {
    const apiKey = await this.apiKeyRepo.findById(
      payload.apiKeyId,
      payload.workspaceId,
    );

    if (!apiKey) {
      throw new UnauthorizedException('API key not found or revoked');
    }

    if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
      throw new UnauthorizedException('API key expired');
    }

    const workspace = await this.workspaceRepo.findById(payload.workspaceId);
    if (!workspace) {
      throw new UnauthorizedException();
    }

    const user = await this.userRepo.findById(
      payload.sub,
      payload.workspaceId,
    );
    if (!user || user.deactivatedAt || user.deletedAt) {
      throw new UnauthorizedException();
    }

    // Fire-and-forget last_used_at update
    this.apiKeyRepo.updateLastUsedAt(apiKey.id).catch(() => {});

    return { user, workspace };
  }

  async createApiKey(opts: {
    name: string;
    expiresAt?: string;
    userId: string;
    workspaceId: string;
  }): Promise<ApiKey & { token: string }> {
    const user = await this.userRepo.findById(opts.userId, opts.workspaceId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const apiKey = await this.apiKeyRepo.insertApiKey({
      name: opts.name,
      creatorId: opts.userId,
      workspaceId: opts.workspaceId,
      expiresAt: opts.expiresAt ? new Date(opts.expiresAt) : null,
    });

    let expiresIn: string | undefined;
    if (opts.expiresAt) {
      const diffMs =
        new Date(opts.expiresAt).getTime() - Date.now();
      expiresIn = Math.max(Math.floor(diffMs / 1000), 60) + 's';
    }

    const token = await this.tokenService.generateApiToken({
      apiKeyId: apiKey.id,
      user,
      workspaceId: opts.workspaceId,
      expiresIn,
    });

    return { ...apiKey, token };
  }

  async getApiKeys(
    creatorId: string,
    workspaceId: string,
    pagination: { limit?: number; cursor?: string; beforeCursor?: string },
  ) {
    const result = await this.apiKeyRepo.findByCreatorId(
      creatorId,
      workspaceId,
      pagination,
    );

    return {
      items: result.items.map(this.formatApiKeyWithCreator),
      meta: result.meta,
    };
  }

  async getWorkspaceApiKeys(
    workspaceId: string,
    pagination: { limit?: number; cursor?: string; beforeCursor?: string },
  ) {
    const result = await this.apiKeyRepo.findAllInWorkspace(
      workspaceId,
      pagination,
    );

    return {
      items: result.items.map(this.formatApiKeyWithCreator),
      meta: result.meta,
    };
  }

  async updateApiKey(
    apiKeyId: string,
    name: string,
    workspaceId: string,
    userId: string,
  ): Promise<ApiKey> {
    const existing = await this.apiKeyRepo.findById(apiKeyId, workspaceId);
    if (!existing) {
      throw new NotFoundException('API key not found');
    }

    if (existing.creatorId !== userId) {
      throw new ForbiddenException('You can only update your own API keys');
    }

    return this.apiKeyRepo.updateApiKey({ name }, apiKeyId, workspaceId);
  }

  async revokeApiKey(
    apiKeyId: string,
    workspaceId: string,
    userId: string,
    isAdmin: boolean,
  ): Promise<void> {
    const existing = await this.apiKeyRepo.findById(apiKeyId, workspaceId);
    if (!existing) {
      throw new NotFoundException('API key not found');
    }

    if (existing.creatorId !== userId && !isAdmin) {
      throw new ForbiddenException('You can only revoke your own API keys');
    }

    await this.apiKeyRepo.softDelete(apiKeyId, workspaceId);
  }

  private formatApiKeyWithCreator(row: any) {
    return {
      id: row.id,
      name: row.name,
      creatorId: row.creatorId,
      workspaceId: row.workspaceId,
      expiresAt: row.expiresAt,
      lastUsedAt: row.lastUsedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      creator: {
        id: row.creatorId,
        name: row.creatorName,
        avatarUrl: row.creatorAvatarUrl,
      },
    };
  }
}
