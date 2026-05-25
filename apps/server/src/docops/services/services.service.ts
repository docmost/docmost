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
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { ListServicesDto } from './dto/list-services.dto';

@Injectable()
export class ServicesService {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async createService(
    dto: CreateServiceDto,
    authUser: User,
    workspace: Workspace,
  ) {
    const existing = await this.db
      .selectFrom('services' as any)
      .select(['id'])
      .where('code' as any, '=', dto.code)
      .executeTakeFirst();

    if (existing) {
      throw new BadRequestException(
        `Service with code '${dto.code}' already exists`,
      );
    }

    let service: any;

    await executeTx(this.db, async (trx) => {
      // create dedicated Docmost space for this service
      const space = await trx
        .insertInto('spaces')
        .values({
          name: dto.name,
          description: dto.description ?? '',
          slug: dto.code,
          creatorId: authUser.id,
          workspaceId: workspace.id,
          visibility: 'private',
        } as any)
        .returningAll()
        .executeTakeFirstOrThrow();

      const ownerId = dto.ownerId ?? authUser.id;

      service = await trx
        .insertInto('services' as any)
        .values({
          code: dto.code,
          name: dto.name,
          description: dto.description ?? null,
          domain: dto.domain ?? null,
          owner_id: ownerId,
          lifecycle_state: dto.lifecycleState ?? 'active',
          space_id: space.id,
          metadata: sql`'{}'::jsonb`,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      if (dto.tags && dto.tags.length > 0) {
        await this.upsertTags(trx, service.id, dto.tags);
      }
    });

    return service;
  }

  async getService(id: string) {
    const service = await this.db
      .selectFrom('services' as any)
      .selectAll()
      .where((eb: any) =>
        eb.or([eb('id', '=', id), eb('code', '=', id)]),
      )
      .executeTakeFirst();

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    const tags = await this.getServiceTags(service.id);
    return { ...service, tags };
  }

  async listServices(dto: ListServicesDto) {
    let query = this.db
      .selectFrom('services as s' as any)
      .selectAll('s' as any)
      .limit(dto.limit ?? 20)
      .offset(dto.offset ?? 0)
      .orderBy('s.name' as any, 'asc');

    if (dto.lifecycleState) {
      query = query.where('s.lifecycle_state' as any, '=', dto.lifecycleState);
    }

    if (dto.domain) {
      query = query.where('s.domain' as any, '=', dto.domain);
    }

    if (dto.search) {
      query = query.where(
        sql`to_tsvector('italian', s.name || ' ' || coalesce(s.description, ''))`,
        '@@',
        sql`plainto_tsquery('italian', ${dto.search})`,
      );
    }

    if (dto.tag) {
      query = query.where(
        's.id' as any,
        'in',
        sql`(
          SELECT st.service_id FROM service_tags st
          INNER JOIN tags t ON t.id = st.tag_id
          WHERE t.name = ${dto.tag}
        )`,
      );
    }

    const items = await query.execute();

    const totalResult = await this.db
      .selectFrom('services' as any)
      .select(this.db.fn.countAll<number>().as('count'))
      .executeTakeFirst();

    return {
      items,
      total: Number(totalResult?.count ?? 0),
      limit: dto.limit ?? 20,
      offset: dto.offset ?? 0,
    };
  }

  async updateService(dto: UpdateServiceDto, actorId: string) {
    await this.getService(dto.id);

    const updates: Record<string, any> = { updated_at: new Date() };
    if (dto.name !== undefined) updates.name = dto.name;
    if (dto.description !== undefined) updates.description = dto.description;
    if (dto.domain !== undefined) updates.domain = dto.domain;
    if (dto.ownerId !== undefined) updates.owner_id = dto.ownerId;
    if (dto.lifecycleState !== undefined)
      updates.lifecycle_state = dto.lifecycleState;

    const service = await this.db
      .updateTable('services' as any)
      .set(updates)
      .where('id' as any, '=', dto.id)
      .returningAll()
      .executeTakeFirstOrThrow();

    if (dto.tags !== undefined) {
      await this.db
        .deleteFrom('service_tags' as any)
        .where('service_id' as any, '=', dto.id)
        .execute();
      if (dto.tags.length > 0) {
        await this.upsertTags(this.db, dto.id, dto.tags);
      }
    }

    const tags = await this.getServiceTags(dto.id);
    return { ...service, tags };
  }

  private async getServiceTags(serviceId: string): Promise<string[]> {
    const rows = await sql<{ name: string }>`
      SELECT t.name
      FROM service_tags st
      INNER JOIN tags t ON t.id = st.tag_id
      WHERE st.service_id = ${serviceId}
    `.execute(this.db);

    return rows.rows.map((r) => r.name);
  }

  private async upsertTags(db: any, serviceId: string, tags: string[]) {
    for (const tagName of tags) {
      const normalizedTag = tagName.trim().toLowerCase();
      if (!normalizedTag) continue;

      let tag = await db
        .selectFrom('tags')
        .select(['id'])
        .where('name', '=', normalizedTag)
        .executeTakeFirst();

      if (!tag) {
        tag = await db
          .insertInto('tags')
          .values({ name: normalizedTag })
          .returning(['id'])
          .executeTakeFirstOrThrow();
      }

      await db
        .insertInto('service_tags')
        .values({ service_id: serviceId, tag_id: tag.id })
        .onConflict((oc: any) => oc.doNothing())
        .execute();
    }
  }
}
