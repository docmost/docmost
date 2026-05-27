import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { executeTx } from '@docmost/db/utils';
import { sql } from 'kysely';
import { generateSlugId } from '../../common/helpers';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { ListServicesDto } from './dto/list-services.dto';
import { ImportServicesDto } from './dto/import-services.dto';
import { ServicesRepository } from './services.repository';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class ServicesService {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly servicesRepo: ServicesRepository,
    private readonly auditService: AuditService,
  ) {}

  async createService(
    dto: CreateServiceDto,
    authUser: User,
    workspace: Workspace,
  ): Promise<any> {
    const existing = await this.servicesRepo.findByIdOrCode(dto.code);
    if (existing) {
      throw new BadRequestException(
        `Service code '${dto.code}' already exists`,
      );
    }

    let service: any;

    await executeTx(this.db, async (trx) => {
      // Create dedicated Docmost Space for this service.
      // slug = service code (already validated as [a-z0-9_-]+).
      const space = await (trx as any)
        .insertInto('spaces')
        .values({
          name: dto.name,
          description: dto.description ?? '',
          slug: dto.code,
          creatorId: authUser.id,
          workspaceId: workspace.id,
          visibility: 'private',
          settings: sql`'{"sharing":{"disabled":true},"comments":{"allowViewerComments":false}}'::jsonb`,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      // Add creator as admin + all other workspace members as writer.
      const otherUsers = await (trx as any)
        .selectFrom('users')
        .select(['id'])
        .where('workspaceId', '=', workspace.id)
        .where('id', '!=', authUser.id)
        .where('deactivatedAt', 'is', null)
        .where('deletedAt', 'is', null)
        .execute();

      const memberRows = [
        { spaceId: space.id, userId: authUser.id, addedById: authUser.id, role: 'admin' },
        ...otherUsers.map((u: { id: string }) => ({
          spaceId: space.id,
          userId: u.id,
          addedById: authUser.id,
          role: 'writer',
        })),
      ];

      await (trx as any)
        .insertInto('spaceMembers')
        .values(memberRows)
        .onConflict((oc: any) => oc.doNothing())
        .execute();

      // Create root page for the service inside the Space.
      const rootPage = await (trx as any)
        .insertInto('pages')
        .values({
          slugId: generateSlugId(),
          title: dto.name,
          spaceId: space.id,
          workspaceId: workspace.id,
          creatorId: authUser.id,
          lastUpdatedById: authUser.id,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      // Persist service with Space and root page bindings.
      service = await this.servicesRepo.insert(
        {
          code: dto.code,
          name: dto.name,
          description: dto.description,
          domain: dto.domain,
          ownerId: dto.ownerId ?? authUser.id,
          lifecycleState: dto.lifecycleState ?? 'active',
          spaceId: space.id,
          rootPageId: rootPage.id,
        },
        trx,
      );

      if (dto.tags && dto.tags.length > 0) {
        await this.servicesRepo.upsertTags(service.id, dto.tags, trx);
      }
    });

    await this.auditService.log({
      actorId: authUser.id,
      action: 'service.created',
      entityKind: 'service',
      entityId: service.id,
      payloadDiff: {
        after: { code: service.code, name: service.name, domain: service.domain },
      },
    });

    const tags = await this.servicesRepo.getServiceTags(service.id);
    return { ...service, tags };
  }

  async getService(idOrCode: string): Promise<any> {
    const service = await this.servicesRepo.findByIdOrCode(idOrCode);
    if (!service) {
      throw new NotFoundException('Service not found');
    }
    const tags = await this.servicesRepo.getServiceTags(service.id);
    return { ...service, tags };
  }

  async getServiceDocument(idOrCode: string): Promise<any> {
    const service = await this.servicesRepo.findByIdOrCode(idOrCode);
    if (!service) {
      throw new NotFoundException('Service not found');
    }
    if (!service.root_page_id) {
      throw new NotFoundException('Service has no root document');
    }

    const page = await (this.db as any)
      .selectFrom('pages')
      .selectAll()
      .where('id', '=', service.root_page_id)
      .executeTakeFirst();

    if (!page) {
      throw new NotFoundException('Service document not found');
    }
    return page;
  }

  async listServices(dto: ListServicesDto): Promise<any> {
    return this.servicesRepo.findAll({
      search: dto.search,
      domain: dto.domain,
      lifecycleState: dto.lifecycleState,
      tag: dto.tag,
      ownerId: dto.ownerId,
      limit: dto.limit ?? 20,
      offset: dto.offset ?? 0,
    });
  }

  async updateService(dto: UpdateServiceDto, authUser: User): Promise<any> {
    const before = await this.getService(dto.id);

    const service = await this.db.transaction().execute(async (trx) => {
      const updated = await this.servicesRepo.update(
        dto.id,
        {
          name: dto.name,
          description: dto.description,
          domain: dto.domain,
          ownerId: dto.ownerId,
          lifecycleState: dto.lifecycleState,
        },
        trx,
      );

      if (dto.tags !== undefined) {
        await this.servicesRepo.clearTags(dto.id, trx);
        if (dto.tags.length > 0) {
          await this.servicesRepo.upsertTags(dto.id, dto.tags, trx);
        }
      }

      return updated;
    });

    await this.auditService.log({
      actorId: authUser.id,
      action: 'service.updated',
      entityKind: 'service',
      entityId: dto.id,
      payloadDiff: {
        before: {
          name: before.name,
          domain: before.domain,
          lifecycle_state: before.lifecycle_state,
        },
        after: {
          name: service.name,
          domain: service.domain,
          lifecycle_state: service.lifecycle_state,
        },
      },
    });

    const tags = await this.servicesRepo.getServiceTags(dto.id);
    return { ...service, tags };
  }

  async retireService(id: string, authUser: User): Promise<any> {
    const before = await this.getService(id);

    const service = await this.servicesRepo.retire(id);

    await this.auditService.log({
      actorId: authUser.id,
      action: 'service.retired',
      entityKind: 'service',
      entityId: id,
      payloadDiff: {
        before: { lifecycle_state: before.lifecycle_state },
        after: { lifecycle_state: 'retired' },
      },
    });

    return service;
  }

  async listTags(): Promise<any[]> {
    return this.servicesRepo.listTags();
  }

  // Bulk import: services are inserted without Space/root page (batch mode).
  // Caller should create Spaces in a follow-up step or via the dedicated
  // single-create endpoint. Skips duplicate codes silently.
  async importServices(
    dto: ImportServicesDto,
    authUser: User,
    workspace: Workspace,
  ): Promise<{ attempted: number; message: string }> {
    const PLACEHOLDER_SPACE_ID = await this.ensureBulkImportSpace(
      authUser,
      workspace,
    );

    const records = dto.services.map((s) => ({
      code: s.code,
      name: s.name,
      description: s.description,
      domain: s.domain,
      ownerId: s.ownerId ?? authUser.id,
      lifecycleState: s.lifecycleState ?? 'active',
      spaceId: PLACEHOLDER_SPACE_ID,
    }));

    const attempted = await this.servicesRepo.bulkInsert(records);

    await this.auditService.log({
      actorId: authUser.id,
      action: 'service.bulk_imported',
      entityKind: 'service',
      entityId: authUser.id,
      payloadDiff: { count: attempted },
    });

    return {
      attempted,
      message: `Import complete. ${attempted} records processed (duplicates skipped).`,
    };
  }

  // Ensures a shared placeholder Space exists for bulk-imported services that
  // have not yet been individually provisioned with their own Space.
  private async ensureBulkImportSpace(
    authUser: User,
    workspace: Workspace,
  ): Promise<string> {
    const BULK_SLUG = '__docops_bulk_import__';

    const existing = await (this.db as any)
      .selectFrom('spaces')
      .select(['id'])
      .where('slug', '=', BULK_SLUG)
      .where('workspaceId', '=', workspace.id)
      .executeTakeFirst();

    if (existing) return existing.id;

    const space = await (this.db as any)
      .insertInto('spaces')
      .values({
        name: 'Bulk Import (placeholder)',
        description: 'Auto-created space for services imported in bulk',
        slug: BULK_SLUG,
        creatorId: authUser.id,
        workspaceId: workspace.id,
        visibility: 'private',
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return space.id;
  }
}
