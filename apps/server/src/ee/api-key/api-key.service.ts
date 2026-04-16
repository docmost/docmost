import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { executeWithCursorPagination } from '@docmost/db/pagination/cursor-pagination';
import { TokenService } from '../../core/auth/services/token.service';
import { UserRepo } from '@docmost/db/repos/user/user.repo';
import { WorkspaceRepo } from '@docmost/db/repos/workspace/workspace.repo';
import { JwtApiKeyPayload } from '../../core/auth/dto/jwt-payload';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { isUserDisabled } from '../../common/helpers';
import { jsonObjectFrom } from 'kysely/helpers/postgres';
import { UserRole } from '../../common/helpers/types/permission';

@Injectable()
export class ApiKeyService {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly tokenService: TokenService,
    private readonly userRepo: UserRepo,
    private readonly workspaceRepo: WorkspaceRepo,
  ) {}

  async listApiKeys(
    workspaceId: string,
    authUser: User,
    opts?: { cursor?: string; beforeCursor?: string; limit?: number; adminView?: boolean },
  ) {
    const adminView = Boolean(opts?.adminView);
    const canManageAll =
      adminView &&
      (authUser.role === UserRole.OWNER || authUser.role === UserRole.ADMIN);

    let query = this.db
      .selectFrom('apiKeys')
      .selectAll('apiKeys')
      .select((eb) =>
        jsonObjectFrom(
          eb
            .selectFrom('users')
            .select(['users.id', 'users.name', 'users.avatarUrl'])
            .whereRef('users.id', '=', 'apiKeys.creatorId'),
        ).as('creator'),
      )
      .where('apiKeys.workspaceId', '=', workspaceId)
      .where('apiKeys.deletedAt', 'is', null);

    if (!canManageAll) {
      query = query.where('apiKeys.creatorId', '=', authUser.id);
    }

    const result = await executeWithCursorPagination(query, {
      perPage: opts?.limit ?? 50,
      cursor: opts?.cursor,
      beforeCursor: opts?.beforeCursor,
      fields: [
        { expression: 'apiKeys.createdAt', direction: 'desc', key: 'createdAt' },
        { expression: 'apiKeys.id', direction: 'desc', key: 'id' },
      ],
      parseCursor: (cursor) => ({
        createdAt: new Date(cursor.createdAt),
        id: cursor.id,
      }),
    });

    return result;
  }

  async createApiKey(
    workspace: Workspace,
    user: User,
    dto: { name: string; expiresAt?: string },
  ) {
    const restrictToAdmins =
      (workspace.settings as Record<string, any> | null)?.api?.restrictToAdmins === true;

    if (
      restrictToAdmins &&
      ![UserRole.OWNER, UserRole.ADMIN].includes(user.role as UserRole)
    ) {
      throw new ForbiddenException('API key creation is restricted to admins');
    }

    let expiresAt: Date | null = null;
    let expiresInMs: number | undefined;
    if (dto.expiresAt) {
      expiresAt = new Date(dto.expiresAt);
      if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
        throw new BadRequestException('expiresAt must be in the future');
      }
      expiresInMs = expiresAt.getTime() - Date.now();
    }

    const inserted = await this.db
      .insertInto('apiKeys')
      .values({
        name: dto.name?.trim() || null,
        creatorId: user.id,
        workspaceId: workspace.id,
        expiresAt,
      })
      .returningAll()
      .executeTakeFirst();

    const token = await this.tokenService.generateApiToken({
      apiKeyId: inserted.id,
      user,
      workspaceId: workspace.id,
      expiresIn: expiresInMs ? `${Math.max(1, Math.floor(expiresInMs / 1000))}s` : undefined,
    });

    return {
      ...inserted,
      token,
      creator: {
        id: user.id,
        name: user.name,
        avatarUrl: user.avatarUrl,
      },
    };
  }

  async updateApiKey(
    workspaceId: string,
    authUser: User,
    dto: { apiKeyId: string; name: string },
  ) {
    const apiKey = await this.findById(dto.apiKeyId, workspaceId);
    this.assertCanManageKey(authUser, apiKey.creatorId);

    await this.db
      .updateTable('apiKeys')
      .set({ name: dto.name?.trim() || null, updatedAt: new Date() })
      .where('id', '=', dto.apiKeyId)
      .where('workspaceId', '=', workspaceId)
      .execute();

    return this.getApiKeyWithCreator(dto.apiKeyId, workspaceId);
  }

  async revokeApiKey(
    workspaceId: string,
    authUser: User,
    apiKeyId: string,
  ): Promise<void> {
    const apiKey = await this.findById(apiKeyId, workspaceId);
    this.assertCanManageKey(authUser, apiKey.creatorId);

    await this.db
      .updateTable('apiKeys')
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where('id', '=', apiKeyId)
      .where('workspaceId', '=', workspaceId)
      .execute();
  }

  async validateApiKey(payload: JwtApiKeyPayload) {
    const apiKey = await this.db
      .selectFrom('apiKeys')
      .selectAll()
      .where('id', '=', payload.apiKeyId)
      .where('workspaceId', '=', payload.workspaceId)
      .where('deletedAt', 'is', null)
      .executeTakeFirst();

    if (!apiKey) {
      throw new UnauthorizedException('Invalid API key');
    }

    if (apiKey.expiresAt && new Date(apiKey.expiresAt).getTime() <= Date.now()) {
      throw new UnauthorizedException('API key has expired');
    }

    const [workspace, user] = await Promise.all([
      this.workspaceRepo.findById(payload.workspaceId),
      this.userRepo.findById(payload.sub, payload.workspaceId),
    ]);

    if (!workspace || !user || isUserDisabled(user)) {
      throw new UnauthorizedException();
    }

    await this.db
      .updateTable('apiKeys')
      .set({ lastUsedAt: new Date(), updatedAt: new Date() })
      .where('id', '=', apiKey.id)
      .execute();

    return { user, workspace };
  }

  private async getApiKeyWithCreator(apiKeyId: string, workspaceId: string) {
    const apiKey = await this.db
      .selectFrom('apiKeys')
      .selectAll('apiKeys')
      .select((eb) =>
        jsonObjectFrom(
          eb
            .selectFrom('users')
            .select(['users.id', 'users.name', 'users.avatarUrl'])
            .whereRef('users.id', '=', 'apiKeys.creatorId'),
        ).as('creator'),
      )
      .where('apiKeys.id', '=', apiKeyId)
      .where('apiKeys.workspaceId', '=', workspaceId)
      .executeTakeFirst();

    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }

    return apiKey;
  }

  private async findById(apiKeyId: string, workspaceId: string) {
    const apiKey = await this.db
      .selectFrom('apiKeys')
      .selectAll()
      .where('id', '=', apiKeyId)
      .where('workspaceId', '=', workspaceId)
      .where('deletedAt', 'is', null)
      .executeTakeFirst();

    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }

    return apiKey;
  }

  private assertCanManageKey(authUser: User, creatorId: string): void {
    const canManageAll =
      authUser.role === UserRole.OWNER || authUser.role === UserRole.ADMIN;

    if (!canManageAll && authUser.id !== creatorId) {
      throw new ForbiddenException();
    }
  }
}
