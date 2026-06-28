import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes, createHash } from 'crypto';
import { ScimTokenRepo } from './scim-token.repo';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { User } from '@docmost/db/types/entity.types';
import WorkspaceAbilityFactory from '../../core/casl/abilities/workspace-ability.factory';
import {
  WorkspaceCaslAction,
  WorkspaceCaslSubject,
} from '../../core/casl/interfaces/workspace-ability.type';
import {
  AUDIT_SERVICE,
  IAuditService,
} from '../../integrations/audit/audit.service';
import { AuditEvent, AuditResource } from '../../common/events/audit-events';

@Injectable()
export class ScimTokenService {
  constructor(
    private readonly scimTokenRepo: ScimTokenRepo,
    private readonly workspaceAbility: WorkspaceAbilityFactory,
    @Inject(AUDIT_SERVICE) private readonly auditService: IAuditService,
  ) {}

  private assertWorkspaceAdmin(user: User, workspaceId: string) {
    const ability = this.workspaceAbility.createForUser(user, {
      id: workspaceId,
    } as any);
    if (
      ability.cannot(WorkspaceCaslAction.Manage, WorkspaceCaslSubject.Settings)
    ) {
      throw new ForbiddenException();
    }
  }

  async list(workspaceId: string, user: User, pagination: PaginationOptions) {
    this.assertWorkspaceAdmin(user, workspaceId);
    return this.scimTokenRepo.listPaginated(workspaceId, pagination);
  }

  async create(workspaceId: string, user: User, data: { name: string }) {
    this.assertWorkspaceAdmin(user, workspaceId);

    const rawToken = `scim_${randomBytes(32).toString('hex')}`;
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const tokenLastFour = rawToken.slice(-4);

    const token = await this.scimTokenRepo.insert({
      name: data.name,
      tokenHash,
      tokenLastFour,
      creatorId: user.id,
      workspaceId,
      isEnabled: true,
    });

    this.auditService.log({
      event: AuditEvent.SCIM_TOKEN_CREATED,
      resourceType: AuditResource.SCIM_TOKEN,
      resourceId: token.id,
    });

    const withCreator = await this.scimTokenRepo.findById(token.id, workspaceId, {
      includeCreator: true,
    });

    return { ...withCreator, token: rawToken };
  }

  async update(
    workspaceId: string,
    user: User,
    data: { tokenId: string; name: string },
  ) {
    this.assertWorkspaceAdmin(user, workspaceId);

    const existing = await this.scimTokenRepo.findById(data.tokenId, workspaceId);
    if (!existing) {
      throw new NotFoundException('SCIM token not found');
    }

    await this.scimTokenRepo.update(data.tokenId, workspaceId, {
      name: data.name,
    });

    this.auditService.log({
      event: AuditEvent.SCIM_TOKEN_UPDATED,
      resourceType: AuditResource.SCIM_TOKEN,
      resourceId: data.tokenId,
    });
  }

  async revoke(workspaceId: string, user: User, tokenId: string) {
    this.assertWorkspaceAdmin(user, workspaceId);

    const existing = await this.scimTokenRepo.findById(tokenId, workspaceId);
    if (!existing) {
      throw new NotFoundException('SCIM token not found');
    }

    await this.scimTokenRepo.softDelete(tokenId, workspaceId);

    this.auditService.log({
      event: AuditEvent.SCIM_TOKEN_DELETED,
      resourceType: AuditResource.SCIM_TOKEN,
      resourceId: tokenId,
    });
  }

  async validateToken(rawToken: string) {
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const token = await this.scimTokenRepo.findByTokenHash(tokenHash);
    if (!token) {
      throw new ForbiddenException('Invalid SCIM token');
    }
    await this.scimTokenRepo.touchLastUsed(token.id);
    return token;
  }
}
