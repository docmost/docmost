import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { BaseRowRepo } from '@docmost/db/repos/base/base-row.repo';
import { BasePropertyRepo } from '@docmost/db/repos/base/base-property.repo';
import { BaseViewRepo } from '@docmost/db/repos/base/base-view.repo';
import { BaseQueryRouter } from '../query-cache/base-query-router';
import { BaseQueryCacheService } from '../query-cache/base-query-cache.service';
import { CreateRowDto } from '../dto/create-row.dto';
import {
  UpdateRowDto,
  DeleteRowDto,
  DeleteRowsDto,
  ListRowsDto,
  ReorderRowDto,
} from '../dto/update-row.dto';
import {
  BasePropertyTypeValue,
  validateCellValue,
  isSystemPropertyType,
} from '../base.schemas';
import { generateJitteredKeyBetween } from 'fractional-indexing-jittered';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { BaseProperty } from '@docmost/db/types/entity.types';
import {
  FilterNode,
  PropertySchema,
  SearchSpec,
  filterGroupSchema,
  searchSchema,
  validateFilterTree,
} from '../engine';
import { EventName } from '../../../common/events/event.contants';
import {
  BaseRowCreatedEvent,
  BaseRowDeletedEvent,
  BaseRowReorderedEvent,
  BaseRowUpdatedEvent,
  BaseRowsDeletedEvent,
} from '../events/base-events';
import { EnvironmentService } from '../../../integrations/environment/environment.service';

@Injectable()
export class BaseRowService {
  private readonly logger = new Logger(BaseRowService.name);

  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly baseRowRepo: BaseRowRepo,
    private readonly basePropertyRepo: BasePropertyRepo,
    private readonly baseViewRepo: BaseViewRepo,
    private readonly eventEmitter: EventEmitter2,
    private readonly queryRouter: BaseQueryRouter,
    private readonly queryCache: BaseQueryCacheService,
    private readonly env: EnvironmentService,
  ) {}

  async create(userId: string, workspaceId: string, dto: CreateRowDto) {
    let position: string;

    if (dto.afterRowId) {
      const afterRow = await this.baseRowRepo.findById(dto.afterRowId, {
        workspaceId,
      });
      if (!afterRow || afterRow.baseId !== dto.baseId) {
        throw new BadRequestException('Invalid afterRowId');
      }
      position = generateJitteredKeyBetween(afterRow.position, null);
    } else {
      const lastPosition = await this.baseRowRepo.getLastPosition(dto.baseId, {
        workspaceId,
      });
      position = generateJitteredKeyBetween(lastPosition, null);
    }

    let validatedCells: Record<string, unknown> = {};
    if (dto.cells && Object.keys(dto.cells).length > 0) {
      const properties = await this.basePropertyRepo.findByBaseId(dto.baseId);
      validatedCells = this.validateCells(dto.cells, properties);
    }

    const created = await this.baseRowRepo.insertRow({
      baseId: dto.baseId,
      cells: validatedCells as any,
      position,
      creatorId: userId,
      workspaceId,
    });

    const event: BaseRowCreatedEvent = {
      baseId: dto.baseId,
      workspaceId,
      actorId: userId,
      requestId: dto.requestId ?? null,
      row: created,
    };
    this.eventEmitter.emit(EventName.BASE_ROW_CREATED, event);

    return created;
  }

  async getRowInfo(rowId: string, baseId: string, workspaceId: string) {
    const row = await this.baseRowRepo.findById(rowId, { workspaceId });
    if (!row || row.baseId !== baseId) {
      throw new NotFoundException('Row not found');
    }
    return row;
  }

  async update(dto: UpdateRowDto, workspaceId: string, userId?: string) {
    const properties = await this.basePropertyRepo.findByBaseId(dto.baseId);
    const validatedCells = this.validateCells(dto.cells, properties);

    const updated = await this.baseRowRepo.updateCells(
      dto.rowId,
      validatedCells,
      {
        baseId: dto.baseId,
        workspaceId,
        actorId: userId,
      },
    );

    if (!updated) {
      throw new NotFoundException('Row not found');
    }

    const event: BaseRowUpdatedEvent = {
      baseId: dto.baseId,
      workspaceId,
      actorId: userId ?? null,
      requestId: dto.requestId ?? null,
      rowId: dto.rowId,
      patch: dto.cells,
      updatedCells: validatedCells,
    };
    this.eventEmitter.emit(EventName.BASE_ROW_UPDATED, event);

    return updated;
  }

  async delete(dto: DeleteRowDto, workspaceId: string, userId?: string) {
    const row = await this.baseRowRepo.findById(dto.rowId, { workspaceId });
    if (!row || row.baseId !== dto.baseId) {
      throw new NotFoundException('Row not found');
    }

    await this.baseRowRepo.softDelete(dto.rowId, {
      baseId: dto.baseId,
      workspaceId,
    });

    const event: BaseRowDeletedEvent = {
      baseId: dto.baseId,
      workspaceId,
      actorId: userId ?? null,
      requestId: dto.requestId ?? null,
      rowId: dto.rowId,
    };
    this.eventEmitter.emit(EventName.BASE_ROW_DELETED, event);
  }

  async deleteMany(
    dto: DeleteRowsDto,
    workspaceId: string,
    userId?: string,
  ): Promise<void> {
    const rows = await this.baseRowRepo.findByIds(dto.rowIds, { workspaceId });
    if (rows.length !== dto.rowIds.length) {
      throw new NotFoundException('One or more rows not found');
    }
    if (rows.some((r) => r.baseId !== dto.baseId)) {
      throw new NotFoundException('Row does not belong to base');
    }

    await this.baseRowRepo.softDeleteMany(dto.rowIds, {
      baseId: dto.baseId,
      workspaceId,
    });

    const event: BaseRowsDeletedEvent = {
      baseId: dto.baseId,
      workspaceId,
      actorId: userId ?? null,
      requestId: dto.requestId ?? null,
      rowIds: dto.rowIds,
    };
    this.eventEmitter.emit(EventName.BASE_ROWS_DELETED, event);
  }

  async list(
    dto: ListRowsDto,
    pagination: PaginationOptions,
    workspaceId: string,
  ) {
    const debug = this.env.getBaseQueryCacheDebug();
    const tStart = debug ? Date.now() : 0;

    const properties = await this.basePropertyRepo.findByBaseId(dto.baseId);
    const schema: PropertySchema = new Map(
      properties.map((p) => [p.id, p]),
    );

    const filter = this.normaliseFilter(dto);
    const search = this.normaliseSearch(dto.search);
    const sorts = dto.sorts?.map((s) => ({
      propertyId: s.propertyId,
      direction: s.direction,
    }));

    const tRouter = debug ? Date.now() : 0;
    const decision = await this.queryRouter.decide({
      baseId: dto.baseId,
      workspaceId,
      filter,
      sorts,
      search,
    });
    const routerMs = debug ? Date.now() - tRouter : 0;

    let resultPath: 'cache' | 'postgres' | 'fallback' = 'postgres';

    if (decision === 'cache') {
      try {
        const tCache = debug ? Date.now() : 0;
        const result = await this.queryCache.list(dto.baseId, workspaceId, {
          filter,
          sorts,
          search,
          schema,
          pagination,
        });
        const cacheMs = debug ? Date.now() - tCache : 0;
        resultPath = 'cache';
        if (debug) {
          console.log(
            '[cache-perf]',
            JSON.stringify({
              path: resultPath,
              baseId: dto.baseId.slice(0, 8),
              totalMs: Date.now() - tStart,
              routerMs,
              cacheMs,
              rows: result.items.length,
            }),
          );
        }
        return result;
      } catch (err) {
        const error = err as Error;
        this.logger.warn(
          `Cache list failed for base ${dto.baseId}, falling back to Postgres: ${error.message}`,
        );
        if (error.stack) this.logger.warn(error.stack);
        resultPath = 'fallback';
      }
    }

    const tPg = debug ? Date.now() : 0;
    const result = await this.baseRowRepo.list({
      baseId: dto.baseId,
      workspaceId,
      filter,
      sorts,
      search,
      schema,
      pagination,
    });
    const pgMs = debug ? Date.now() - tPg : 0;
    if (debug) {
      console.log(
        '[cache-perf]',
        JSON.stringify({
          path: resultPath,
          baseId: dto.baseId.slice(0, 8),
          totalMs: Date.now() - tStart,
          routerMs,
          pgMs,
          rows: result.items.length,
        }),
      );
    }
    return result;
  }

  async reorder(dto: ReorderRowDto, workspaceId: string, userId?: string) {
    const row = await this.baseRowRepo.findById(dto.rowId, { workspaceId });
    if (!row || row.baseId !== dto.baseId) {
      throw new NotFoundException('Row not found');
    }

    try {
      generateJitteredKeyBetween(dto.position, null);
    } catch {
      throw new BadRequestException('Invalid position value');
    }

    await this.baseRowRepo.updatePosition(dto.rowId, dto.position, {
      baseId: dto.baseId,
      workspaceId,
    });

    const event: BaseRowReorderedEvent = {
      baseId: dto.baseId,
      workspaceId,
      actorId: userId ?? null,
      requestId: dto.requestId ?? null,
      rowId: dto.rowId,
      position: dto.position,
    };
    this.eventEmitter.emit(EventName.BASE_ROW_REORDERED, event);
  }

  // --- private helpers ------------------------------------------------

  private normaliseFilter(dto: ListRowsDto): FilterNode | undefined {
    if (!dto.filter) return undefined;

    const parsed = filterGroupSchema.safeParse(dto.filter);
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Invalid filter tree',
        issues: parsed.error.issues,
      });
    }
    try {
      validateFilterTree(parsed.data);
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
    return parsed.data;
  }

  private normaliseSearch(raw: unknown): SearchSpec | undefined {
    if (raw == null) return undefined;
    const parsed = searchSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Invalid search spec',
        issues: parsed.error.issues,
      });
    }
    return parsed.data;
  }

  private validateCells(
    cells: Record<string, unknown>,
    properties: BaseProperty[],
  ): Record<string, unknown> {
    const propertyMap = new Map(properties.map((p) => [p.id, p]));
    const validatedCells: Record<string, unknown> = {};
    const errors: string[] = [];

    for (const [propertyId, value] of Object.entries(cells)) {
      const property = propertyMap.get(propertyId);
      if (!property) {
        errors.push(`Unknown property: ${propertyId}`);
        continue;
      }

      if (isSystemPropertyType(property.type)) {
        continue;
      }

      if (value === null || value === undefined) {
        validatedCells[propertyId] = null;
        continue;
      }

      const result = validateCellValue(
        property.type as BasePropertyTypeValue,
        value,
      );

      if (!result.success) {
        errors.push(
          `Invalid value for property "${property.name}" (${property.type}): ${result.error.issues[0]?.message}`,
        );
        continue;
      }

      validatedCells[propertyId] = result.data;
    }

    if (errors.length > 0) {
      throw new BadRequestException({
        message: 'Cell validation failed',
        errors,
      });
    }

    return validatedCells;
  }
}
