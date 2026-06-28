import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiKeyRepo } from './api-key.repo';
import { TokenService } from '../../core/auth/services/token.service';
import { UserRepo } from '@docmost/db/repos/user/user.repo';
import { WorkspaceRepo } from '@docmost/db/repos/workspace/workspace.repo';
import { JwtApiKeyPayload } from '../../core/auth/dto/jwt-payload';
import { EnvironmentService } from '../../integrations/environment/environment.service';
import {
  AUDIT_SERVICE,
  IAuditService,
} from '../../integrations/audit/audit.service';
import { AuditEvent, AuditResource } from '../../common/events/audit-events';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { isUserDisabled } from '../../common/helpers';
import { StringValue } from 'ms';

@Injectable()
export class ApiKeyService {
  constructor(
    private readonly apiKeyRepo: ApiKeyRepo,
    private readonly tokenService: TokenService,
    private readonly userRepo: UserRepo,
    private readonly workspaceRepo: WorkspaceRepo,
    private readonly environmentService: EnvironmentService,
    @Inject(AUDIT_SERVICE) private readonly auditService: IAuditService,
  ) {}

  async list(
    workspaceId: string,
    userId: string,
    pagination: PaginationOptions,
    adminView?: boolean,
  ) {
    return this.apiKeyRepo.listPaginated(workspaceId, pagination, {
      creatorId: adminView ? undefined : userId,
    });
  }

  async create(
    workspaceId: string,
    user: User,
    data: { name: string; expiresAt?: string },
  ) {
    const apiKey = await this.apiKeyRepo.insert({
      name: data.name,
      creatorId: user.id,
      workspaceId,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
    });

    const token = await this.tokenService.generateApiToken({
      apiKeyId: apiKey.id,
      user,
      workspaceId,
      expiresIn: data.expiresAt
        ? undefined
        : (this.environmentService.getJwtTokenExpiresIn() as StringValue),
    });

    this.auditService.log({
      event: AuditEvent.API_KEY_CREATED,
      resourceType: AuditResource.API_KEY,
      resourceId: apiKey.id,
      metadata: { name: data.name },
    });

    const withCreator = await this.apiKeyRepo.findById(apiKey.id, workspaceId, {
      includeCreator: true,
    });

    return { ...withCreator, token };
  }

  async update(
    workspaceId: string,
    userId: string,
    data: { apiKeyId: string; name: string },
    isAdmin: boolean,
  ) {
    const existing = await this.apiKeyRepo.findById(data.apiKeyId, workspaceId);
    if (!existing) {
      throw new NotFoundException('API key not found');
    }
    if (!isAdmin && existing.creatorId !== userId) {
      throw new ForbiddenException();
    }

    const updated = await this.apiKeyRepo.update(data.apiKeyId, workspaceId, {
      name: data.name,
    });

    this.auditService.log({
      event: AuditEvent.API_KEY_UPDATED,
      resourceType: AuditResource.API_KEY,
      resourceId: data.apiKeyId,
      changes: { after: { name: data.name } },
    });

    return this.apiKeyRepo.findById(updated.id, workspaceId, {
      includeCreator: true,
    });
  }

  async revoke(
    workspaceId: string,
    userId: string,
    apiKeyId: string,
    isAdmin: boolean,
  ) {
    const existing = await this.apiKeyRepo.findById(apiKeyId, workspaceId);
    if (!existing) {
      throw new NotFoundException('API key not found');
    }
    if (!isAdmin && existing.creatorId !== userId) {
      throw new ForbiddenException();
    }

    await this.apiKeyRepo.softDelete(apiKeyId, workspaceId);

    this.auditService.log({
      event: AuditEvent.API_KEY_DELETED,
      resourceType: AuditResource.API_KEY,
      resourceId: apiKeyId,
    });
  }

  async validateApiKey(payload: JwtApiKeyPayload) {
    const apiKey = await this.apiKeyRepo.findById(
      payload.apiKeyId,
      payload.workspaceId,
    );

    if (!apiKey || apiKey.deletedAt) {
      throw new UnauthorizedException('Invalid API key');
    }

    if (apiKey.expiresAt && new Date() > new Date(apiKey.expiresAt)) {
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

    await this.apiKeyRepo.touchLastUsed(apiKey.id);

    return { user, workspace };
  }
}
