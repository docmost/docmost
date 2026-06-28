import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { BaseRepo } from './base.repo';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { PageService } from '../../core/page/services/page.service';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import SpaceAbilityFactory from '../../core/casl/abilities/space-ability.factory';
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from '../../core/casl/interfaces/space-ability.type';
import { User } from '@docmost/db/types/entity.types';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { generateJitteredKeyBetween } from 'fractional-indexing-jittered';
import { v7 as uuid7 } from 'uuid';
import { executeTx } from '@docmost/db/utils';
import { JsonValue } from '@docmost/db/types/db';

const DEFAULT_STATUS_OPTIONS = {
  choices: [
    { id: 'todo', name: 'To Do', color: 'gray', category: 'todo' },
    {
      id: 'inProgress',
      name: 'In Progress',
      color: 'blue',
      category: 'inProgress',
    },
    { id: 'done', name: 'Done', color: 'green', category: 'complete' },
  ],
  choiceOrder: ['todo', 'inProgress', 'done'],
};

@Injectable()
export class BaseService {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly baseRepo: BaseRepo,
    private readonly pageRepo: PageRepo,
    private readonly pageService: PageService,
    private readonly spaceMemberRepo: SpaceMemberRepo,
    private readonly spaceAbility: SpaceAbilityFactory,
  ) {}

  private mapDate(d: unknown) {
    return (d as Date)?.toISOString?.() ?? d;
  }

  private mapProperty(p: any) {
    return {
      id: p.id,
      pageId: p.pageId,
      name: p.name,
      type: p.type,
      position: p.position,
      typeOptions: p.typeOptions ?? {},
      pendingType: p.pendingType,
      pendingTypeOptions: p.pendingTypeOptions,
      isPrimary: p.isPrimary,
      workspaceId: p.workspaceId,
      createdAt: this.mapDate(p.createdAt),
      updatedAt: this.mapDate(p.updatedAt),
    };
  }

  private mapView(v: any) {
    return {
      id: v.id,
      pageId: v.pageId,
      name: v.name,
      type: v.type,
      config: v.config ?? {},
      position: v.position,
      workspaceId: v.workspaceId,
      creatorId: v.creatorId,
      createdAt: this.mapDate(v.createdAt),
      updatedAt: this.mapDate(v.updatedAt),
    };
  }

  private mapRow(r: any) {
    return {
      id: r.id,
      pageId: r.pageId,
      cells: r.cells ?? {},
      position: r.position,
      creatorId: r.creatorId,
      lastUpdatedById: r.lastUpdatedById,
      workspaceId: r.workspaceId,
      createdAt: this.mapDate(r.createdAt),
      updatedAt: this.mapDate(r.updatedAt),
    };
  }

  private async assertSpaceAccess(user: User, spaceId: string) {
    const spaceIds = await this.spaceMemberRepo.getUserSpaceIds(user.id);
    if (!spaceIds.includes(spaceId)) {
      throw new ForbiddenException();
    }
  }

  private async assertCanEdit(user: User, spaceId: string) {
    const ability = await this.spaceAbility.createForUser(user, spaceId);
    if (ability.cannot(SpaceCaslAction.Edit, SpaceCaslSubject.Page)) {
      throw new ForbiddenException();
    }
  }

  private async getBasePageOrThrow(pageId: string, workspaceId: string) {
    const page = await this.pageRepo.findById(pageId);
    if (!page || page.deletedAt || page.workspaceId !== workspaceId) {
      throw new NotFoundException('Base not found');
    }
    if (!page.isBase) {
      throw new BadRequestException('Page is not a base');
    }
    return page;
  }

  private async buildBaseDto(page: any, includeChildren = true) {
    const properties = includeChildren
      ? (await this.baseRepo.getProperties(page.id)).map((p) =>
          this.mapProperty(p),
        )
      : [];
    const views = includeChildren
      ? (await this.baseRepo.getViews(page.id)).map((v) => this.mapView(v))
      : [];

    return {
      id: page.id,
      slugId: page.slugId,
      name: page.title,
      icon: page.icon,
      pageId: page.id,
      spaceId: page.spaceId,
      workspaceId: page.workspaceId,
      creatorId: page.creatorId,
      properties,
      views,
      createdAt: this.mapDate(page.createdAt),
      updatedAt: this.mapDate(page.updatedAt),
      baseSchemaVersion: page.baseSchemaVersion ?? 0,
      permissions: { canEdit: true, hasRestriction: false },
    };
  }

  private async seedDefaultBase(
    pageId: string,
    workspaceId: string,
    userId: string,
    trx: any,
    template?: string,
  ) {
    const namePropId = uuid7().replace(/-/g, '').slice(0, 16);
    const namePosition = generateJitteredKeyBetween(null, null);

    await this.baseRepo.insertProperty(
      {
        id: namePropId,
        pageId,
        name: 'Name',
        type: 'text',
        position: namePosition,
        isPrimary: true,
        typeOptions: { defaultValue: null },
        workspaceId,
      },
      trx,
    );

    let statusPropId: string | undefined;
    if (template === 'kanban') {
      statusPropId = uuid7().replace(/-/g, '').slice(0, 16);
      const statusPosition = generateJitteredKeyBetween(namePosition, null);
      await this.baseRepo.insertProperty(
        {
          id: statusPropId,
          pageId,
          name: 'Status',
          type: 'status',
          position: statusPosition,
          typeOptions: DEFAULT_STATUS_OPTIONS as JsonValue,
          workspaceId,
        },
        trx,
      );
    }

    const viewPosition = generateJitteredKeyBetween(null, null);
    const viewType = template === 'kanban' ? 'kanban' : 'table';
    const viewConfig: Record<string, unknown> =
      template === 'kanban' && statusPropId
        ? { groupByPropertyId: statusPropId }
        : {};

    await this.baseRepo.insertView(
      {
        pageId,
        name: template === 'kanban' ? 'Kanban' : 'Table',
        type: viewType,
        position: viewPosition,
        config: viewConfig as JsonValue,
        creatorId: userId,
        workspaceId,
      },
      trx,
    );

    const rowPosition = generateJitteredKeyBetween(null, null);
    const cells: Record<string, unknown> = {};
    await this.baseRepo.insertRow(
      {
        pageId,
        position: rowPosition,
        cells: cells as JsonValue,
        creatorId: userId,
        workspaceId,
      },
      trx,
    );
  }

  async create(
    user: User,
    workspaceId: string,
    data: {
      name: string;
      description?: string;
      icon?: string;
      spaceId: string;
      pageId?: string;
    },
  ) {
    await this.assertSpaceAccess(user, data.spaceId);
    await this.assertCanEdit(user, data.spaceId);

    return executeTx(this.db, async (trx) => {
      const page = await this.pageService.create(
        user.id,
        workspaceId,
        {
          title: data.name,
          spaceId: data.spaceId,
          icon: data.icon,
          parentPageId: data.pageId,
        },
        trx,
        true,
      );

      await this.seedDefaultBase(page.id, workspaceId, user.id, trx);
      return this.buildBaseDto(page);
    });
  }

  async getInfo(pageId: string, user: User, workspaceId: string) {
    const page = await this.getBasePageOrThrow(pageId, workspaceId);
    await this.assertSpaceAccess(user, page.spaceId);
    return this.buildBaseDto(page);
  }

  async update(
    user: User,
    workspaceId: string,
    data: { pageId: string; name?: string; icon?: string; description?: string },
  ) {
    const page = await this.getBasePageOrThrow(data.pageId, workspaceId);
    await this.assertCanEdit(user, page.spaceId);

    if (data.name !== undefined || data.icon !== undefined) {
      await this.pageRepo.updatePage(
        {
          ...(data.name !== undefined ? { title: data.name } : {}),
          ...(data.icon !== undefined ? { icon: data.icon } : {}),
          lastUpdatedById: user.id,
        },
        data.pageId,
      );
    }

    const updated = await this.pageRepo.findById(data.pageId);
    return this.buildBaseDto(updated);
  }

  async delete(pageId: string, user: User, workspaceId: string) {
    const page = await this.getBasePageOrThrow(pageId, workspaceId);
    await this.assertCanEdit(user, page.spaceId);
    await this.pageService.removePage(pageId, user.id, workspaceId);
  }

  async convert(
    pageId: string,
    user: User,
    workspaceId: string,
    template?: string,
  ) {
    const page = await this.pageRepo.findById(pageId);
    if (!page || page.deletedAt || page.workspaceId !== workspaceId) {
      throw new NotFoundException('Page not found');
    }
    if (page.isBase) {
      return this.buildBaseDto(page);
    }
    await this.assertCanEdit(user, page.spaceId);

    await executeTx(this.db, async (trx) => {
      await this.baseRepo.markPageAsBase(pageId, trx);
      await this.seedDefaultBase(pageId, workspaceId, user.id, trx, template);
    });

    const updated = await this.pageRepo.findById(pageId);
    return this.buildBaseDto(updated);
  }

  async list(
    spaceId: string,
    user: User,
    workspaceId: string,
    pagination: PaginationOptions,
  ) {
    await this.assertSpaceAccess(user, spaceId);
    const result = await this.baseRepo.listBasesInSpace(
      spaceId,
      workspaceId,
      pagination,
    );
    const items = await Promise.all(
      result.items.map(async (page) => {
        const dto = await this.buildBaseDto(page, false);
        return dto;
      }),
    );
    return { ...result, items };
  }

  async createProperty(
    user: User,
    workspaceId: string,
    data: {
      pageId: string;
      name: string;
      type: string;
      typeOptions?: JsonValue;
    },
  ) {
    const page = await this.getBasePageOrThrow(data.pageId, workspaceId);
    await this.assertCanEdit(user, page.spaceId);

    const lastPos = await this.baseRepo.getLastPropertyPosition(data.pageId);
    const position = generateJitteredKeyBetween(lastPos, null);
    const property = await this.baseRepo.insertProperty({
      id: uuid7().replace(/-/g, '').slice(0, 16),
      pageId: data.pageId,
      name: data.name.trim(),
      type: data.type,
      position,
      typeOptions: data.typeOptions,
      workspaceId,
    });
    return this.mapProperty(property);
  }

  async updateProperty(
    user: User,
    workspaceId: string,
    data: {
      pageId: string;
      propertyId: string;
      name?: string;
      type?: string;
      typeOptions?: JsonValue;
    },
  ) {
    const page = await this.getBasePageOrThrow(data.pageId, workspaceId);
    await this.assertCanEdit(user, page.spaceId);

    const existing = await this.baseRepo.getProperty(
      data.pageId,
      data.propertyId,
    );
    if (!existing) {
      throw new NotFoundException('Property not found');
    }

    const property = await this.baseRepo.updateProperty(
      data.pageId,
      data.propertyId,
      {
        name: data.name?.trim(),
        type: data.type,
        typeOptions: data.typeOptions,
      },
    );
    return { property: this.mapProperty(property), jobId: null };
  }

  async deleteProperty(
    user: User,
    workspaceId: string,
    data: { pageId: string; propertyId: string },
  ) {
    const page = await this.getBasePageOrThrow(data.pageId, workspaceId);
    await this.assertCanEdit(user, page.spaceId);
    const existing = await this.baseRepo.getProperty(
      data.pageId,
      data.propertyId,
    );
    if (!existing) {
      throw new NotFoundException('Property not found');
    }
    if (existing.isPrimary) {
      throw new BadRequestException('Cannot delete primary property');
    }
    await this.baseRepo.softDeleteProperty(data.pageId, data.propertyId);
  }

  async reorderProperty(
    user: User,
    workspaceId: string,
    data: { pageId: string; propertyId: string; position: string },
  ) {
    const page = await this.getBasePageOrThrow(data.pageId, workspaceId);
    await this.assertCanEdit(user, page.spaceId);
    await this.baseRepo.updateProperty(data.pageId, data.propertyId, {
      position: data.position,
    });
  }

  async createRow(
    user: User,
    workspaceId: string,
    data: {
      pageId: string;
      cells?: Record<string, unknown>;
      position?: string;
      afterRowId?: string;
    },
  ) {
    const page = await this.getBasePageOrThrow(data.pageId, workspaceId);
    await this.assertCanEdit(user, page.spaceId);

    let position = data.position;
    if (!position) {
      const lastPos = await this.baseRepo.getLastRowPosition(data.pageId);
      position = generateJitteredKeyBetween(lastPos, null);
    }

    const row = await this.baseRepo.insertRow({
      pageId: data.pageId,
      position,
      cells: (data.cells ?? {}) as JsonValue,
      creatorId: user.id,
      workspaceId,
    });
    return this.mapRow(row);
  }

  async getRow(
    rowId: string,
    pageId: string,
    user: User,
    workspaceId: string,
  ) {
    const page = await this.getBasePageOrThrow(pageId, workspaceId);
    await this.assertSpaceAccess(user, page.spaceId);
    const row = await this.baseRepo.getRow(pageId, rowId);
    if (!row) {
      throw new NotFoundException('Row not found');
    }
    return this.mapRow(row);
  }

  async updateRow(
    user: User,
    workspaceId: string,
    data: {
      pageId: string;
      rowId: string;
      cells?: Record<string, unknown>;
      position?: string;
    },
  ) {
    const page = await this.getBasePageOrThrow(data.pageId, workspaceId);
    await this.assertCanEdit(user, page.spaceId);
    const row = await this.baseRepo.updateRow(data.pageId, data.rowId, {
      cells: data.cells as JsonValue,
      position: data.position,
      lastUpdatedById: user.id,
    });
    if (!row) {
      throw new NotFoundException('Row not found');
    }
    return this.mapRow(row);
  }

  async deleteRow(
    user: User,
    workspaceId: string,
    data: { pageId: string; rowId: string },
  ) {
    const page = await this.getBasePageOrThrow(data.pageId, workspaceId);
    await this.assertCanEdit(user, page.spaceId);
    await this.baseRepo.softDeleteRow(data.pageId, data.rowId);
  }

  async deleteRows(
    user: User,
    workspaceId: string,
    data: { pageId: string; rowIds: string[] },
  ) {
    const page = await this.getBasePageOrThrow(data.pageId, workspaceId);
    await this.assertCanEdit(user, page.spaceId);
    await this.baseRepo.softDeleteRows(data.pageId, data.rowIds);
  }

  async listRows(
    pageId: string,
    user: User,
    workspaceId: string,
    pagination: PaginationOptions,
  ) {
    const page = await this.getBasePageOrThrow(pageId, workspaceId);
    await this.assertSpaceAccess(user, page.spaceId);
    const result = await this.baseRepo.listRows(pageId, pagination);
    return {
      ...result,
      items: result.items.map((r) => this.mapRow(r)),
      references: { users: {}, pages: {} },
    };
  }

  async reorderRow(
    user: User,
    workspaceId: string,
    data: { pageId: string; rowId: string; position: string },
  ) {
    const page = await this.getBasePageOrThrow(data.pageId, workspaceId);
    await this.assertCanEdit(user, page.spaceId);
    await this.baseRepo.updateRow(data.pageId, data.rowId, {
      position: data.position,
      lastUpdatedById: user.id,
    });
  }

  async createView(
    user: User,
    workspaceId: string,
    data: {
      pageId: string;
      name: string;
      type: string;
      config?: JsonValue;
    },
  ) {
    const page = await this.getBasePageOrThrow(data.pageId, workspaceId);
    await this.assertCanEdit(user, page.spaceId);
    const views = await this.baseRepo.getViews(data.pageId);
    const lastPos = views.length > 0 ? views[views.length - 1].position : null;
    const view = await this.baseRepo.insertView({
      pageId: data.pageId,
      name: data.name,
      type: data.type,
      position: generateJitteredKeyBetween(lastPos, null),
      config: data.config,
      creatorId: user.id,
      workspaceId,
    });
    return this.mapView(view);
  }

  async updateView(
    user: User,
    workspaceId: string,
    data: {
      pageId: string;
      viewId: string;
      name?: string;
      type?: string;
      config?: JsonValue;
      position?: string;
    },
  ) {
    const page = await this.getBasePageOrThrow(data.pageId, workspaceId);
    await this.assertCanEdit(user, page.spaceId);
    const view = await this.baseRepo.updateView(data.pageId, data.viewId, data);
    if (!view) {
      throw new NotFoundException('View not found');
    }
    return this.mapView(view);
  }

  async deleteView(
    user: User,
    workspaceId: string,
    data: { pageId: string; viewId: string },
  ) {
    const page = await this.getBasePageOrThrow(data.pageId, workspaceId);
    await this.assertCanEdit(user, page.spaceId);
    const views = await this.baseRepo.getViews(data.pageId);
    if (views.length <= 1) {
      throw new BadRequestException('Cannot delete the last view');
    }
    await this.baseRepo.deleteView(data.pageId, data.viewId);
  }

  async listViews(pageId: string, user: User, workspaceId: string) {
    const page = await this.getBasePageOrThrow(pageId, workspaceId);
    await this.assertSpaceAccess(user, page.spaceId);
    const views = await this.baseRepo.getViews(pageId);
    return views.map((v) => this.mapView(v));
  }

  async expandPages(pageIds: string[], user: User, workspaceId: string) {
    const rows = await this.baseRepo.expandPages(pageIds, workspaceId);
    return {
      items: rows.map((r) => ({
        id: r.id,
        slugId: r.slugId,
        title: r.title,
        icon: r.icon,
        spaceId: r.spaceId,
        space: r.spaceRefId
          ? { id: r.spaceRefId, slug: r.spaceSlug, name: r.spaceName }
          : null,
      })),
    };
  }

  async exportCsv(pageId: string, user: User, workspaceId: string) {
    const base = await this.getInfo(pageId, user, workspaceId);
    const rows = await this.baseRepo.listRows(pageId, {
      limit: 10000,
    } as PaginationOptions);
    const headers = base.properties.map((p) => p.name);
    const lines = [headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(',')];
    for (const row of rows.items) {
      const cells = base.properties.map((p) => {
        const val = (row.cells as Record<string, unknown>)?.[p.id];
        const text = val == null ? '' : String(val);
        return `"${text.replace(/"/g, '""')}"`;
      });
      lines.push(cells.join(','));
    }
    const csv = lines.join('\n');
    const fileName = `${base.name || 'base'}.csv`;
    return { csv, fileName };
  }
}
