// TODO(formula): when bulk create/update is added, consult FormulaService.inlineThreshold
// and enqueue a BASE_FORMULA_RECOMPUTE job with reason: "bulk_import" for the
// affected row IDs when above threshold; inline-eval below.
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { BaseRowRepo } from '@docmost/db/repos/base/base-row.repo';
import { BasePropertyRepo } from '@docmost/db/repos/base/base-property.repo';
import { BaseViewRepo } from '@docmost/db/repos/base/base-view.repo';
import { CreateRowDto } from '../dto/create-row.dto';
import {
  UpdateRowDto,
  DeleteRowDto,
  DeleteRowsDto,
  ListRowsDto,
  ReorderRowDto,
  CountRowsDto,
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
  Condition,
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
import { FormulaService } from '../formula/formula.service';

// Cap for `count({ exact: true })`. Beyond this we return `capped: true` and
// the UI shows "N+". Chosen so a cell-wise scan stays well under 100ms on
// the existing `idx_base_rows_cells_gin_path_ops` index; callers that need
// true totals should fall back to `exact: false` (planner estimate).
const EXACT_COUNT_CAP = 10_000;

@Injectable()
export class BaseRowService {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly baseRowRepo: BaseRowRepo,
    private readonly basePropertyRepo: BasePropertyRepo,
    private readonly baseViewRepo: BaseViewRepo,
    private readonly eventEmitter: EventEmitter2,
    private readonly formulaService: FormulaService,
  ) {}

  async create(userId: string, workspaceId: string, dto: CreateRowDto) {
    let position: string;

    if (dto.afterRowId) {
      const afterRow = await this.baseRowRepo.findById(dto.afterRowId, {
        workspaceId,
      });
      if (!afterRow || afterRow.pageId !== dto.pageId) {
        throw new BadRequestException('Invalid afterRowId');
      }
      position = generateJitteredKeyBetween(afterRow.position, null);
    } else {
      const lastPosition = await this.baseRowRepo.getLastPosition(dto.pageId, {
        workspaceId,
      });
      position = generateJitteredKeyBetween(lastPosition, null);
    }

    const properties = await this.basePropertyRepo.findByPageId(dto.pageId);

    let validatedCells: Record<string, unknown> = {};
    if (dto.cells && Object.keys(dto.cells).length > 0) {
      validatedCells = this.validateCells(dto.cells, properties);
    }

    // On create, treat every user-provided cell plus every formula property
    // as dirty. The formula patch is merged into the cells we persist.
    const dirtyProps = Object.keys(validatedCells);
    const formulaPatch = this.formulaService.evaluateInline({
      properties,
      row: validatedCells,
      dirtyProps: [
        ...dirtyProps,
        ...properties.filter((p) => p.type === 'formula').map((p) => p.id),
      ],
    });
    const finalCells = { ...validatedCells, ...formulaPatch };

    const created = await this.baseRowRepo.insertRow({
      pageId: dto.pageId,
      cells: finalCells as any,
      position,
      creatorId: userId,
      workspaceId,
    });

    const event: BaseRowCreatedEvent = {
      pageId: dto.pageId,
      workspaceId,
      actorId: userId,
      requestId: dto.requestId ?? null,
      row: created,
    };
    this.eventEmitter.emit(EventName.BASE_ROW_CREATED, event);

    return created;
  }

  async getRowInfo(rowId: string, pageId: string, workspaceId: string) {
    const row = await this.baseRowRepo.findById(rowId, { workspaceId });
    if (!row || row.pageId !== pageId) {
      throw new NotFoundException('Row not found');
    }
    return row;
  }

  async update(dto: UpdateRowDto, workspaceId: string, userId?: string) {
    const properties = await this.basePropertyRepo.findByPageId(dto.pageId);
    const validatedCells = this.validateCells(dto.cells, properties);

    // Smoke-check the position (same guard as `reorder`).
    if (dto.position !== undefined) {
      try {
        generateJitteredKeyBetween(dto.position, null);
      } catch {
        throw new BadRequestException('Invalid position value');
      }
    }

    const existing = await this.baseRowRepo.findById(dto.rowId, { workspaceId });
    const mergedRow = {
      ...((existing?.cells as Record<string, unknown>) ?? {}),
      ...validatedCells,
    };
    const formulaPatch = this.formulaService.evaluateInline({
      properties,
      row: mergedRow,
      dirtyProps: Object.keys(validatedCells),
    });
    const finalCells = { ...validatedCells, ...formulaPatch };

    const updated = await this.baseRowRepo.updateCells(
      dto.rowId,
      finalCells,
      {
        pageId: dto.pageId,
        workspaceId,
        actorId: userId,
        position: dto.position,
      },
    );

    if (!updated) {
      throw new NotFoundException('Row not found');
    }

    const event: BaseRowUpdatedEvent = {
      pageId: dto.pageId,
      workspaceId,
      actorId: userId ?? null,
      requestId: dto.requestId ?? null,
      rowId: dto.rowId,
      patch: dto.cells,
      updatedCells: finalCells,
    };
    this.eventEmitter.emit(EventName.BASE_ROW_UPDATED, event);

    return updated;
  }

  async delete(dto: DeleteRowDto, workspaceId: string, userId?: string) {
    const row = await this.baseRowRepo.findById(dto.rowId, { workspaceId });
    if (!row || row.pageId !== dto.pageId) {
      throw new NotFoundException('Row not found');
    }

    await this.baseRowRepo.softDelete(dto.rowId, {
      pageId: dto.pageId,
      workspaceId,
    });

    const event: BaseRowDeletedEvent = {
      pageId: dto.pageId,
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
    if (rows.some((r) => r.pageId !== dto.pageId)) {
      throw new NotFoundException('Row does not belong to base');
    }

    await this.baseRowRepo.softDeleteMany(dto.rowIds, {
      pageId: dto.pageId,
      workspaceId,
    });

    const event: BaseRowsDeletedEvent = {
      pageId: dto.pageId,
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
    const properties = await this.basePropertyRepo.findByPageId(dto.pageId);
    const schema: PropertySchema = new Map(
      properties.map((p) => [p.id, p]),
    );

    const filter = this.normaliseFilter(dto);
    const search = this.normaliseSearch(dto.search);
    const sorts = dto.sorts?.map((s) => ({
      propertyId: s.propertyId,
      direction: s.direction,
    }));

    return this.baseRowRepo.list({
      pageId: dto.pageId,
      workspaceId,
      filter,
      sorts,
      search,
      schema,
      pagination,
    });
  }

  async count(dto: CountRowsDto, workspaceId: string) {
    const properties = await this.basePropertyRepo.findByPageId(dto.pageId);
    const schema: PropertySchema = new Map(properties.map((p) => [p.id, p]));

    const filter = this.normaliseFilter({ filter: dto.filter });
    const search = this.normaliseSearch(dto.search);

    // Planner estimates are untrustworthy for ILIKE / FTS predicates on
    // jsonb-extracted cells — PG falls back to a default selectivity and
    // returns numbers off by orders of magnitude. Auto-escalate such
    // requests to the capped-exact path even when the caller asked for
    // an estimate.
    const useExact = dto.exact || requiresExactCount(filter, search);

    if (useExact) {
      const { value, capped } = await this.baseRowRepo.countExact({
        pageId: dto.pageId,
        workspaceId,
        filter,
        search,
        schema,
        cap: EXACT_COUNT_CAP,
      });
      return { value, exact: true as const, capped };
    }

    const estimate = await this.baseRowRepo.countEstimate({
      pageId: dto.pageId,
      workspaceId,
      filter,
      search,
      schema,
    });
    return {
      value: estimate ?? 0,
      exact: false as const,
      capped: false,
    };
  }

  async reorder(dto: ReorderRowDto, workspaceId: string, userId?: string) {
    const row = await this.baseRowRepo.findById(dto.rowId, { workspaceId });
    if (!row || row.pageId !== dto.pageId) {
      throw new NotFoundException('Row not found');
    }

    try {
      generateJitteredKeyBetween(dto.position, null);
    } catch {
      throw new BadRequestException('Invalid position value');
    }

    await this.baseRowRepo.updatePosition(dto.rowId, dto.position, {
      pageId: dto.pageId,
      workspaceId,
    });

    const event: BaseRowReorderedEvent = {
      pageId: dto.pageId,
      workspaceId,
      actorId: userId ?? null,
      requestId: dto.requestId ?? null,
      rowId: dto.rowId,
      position: dto.position,
    };
    this.eventEmitter.emit(EventName.BASE_ROW_REORDERED, event);
  }

  // --- private helpers ------------------------------------------------

  private normaliseFilter(dto: { filter?: unknown }): FilterNode | undefined {
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

// Any filter op whose SQL is ILIKE-based, or a present search term. The
// PG planner has no stats for `cells->>'uuid' ILIKE '%x%'` / `search_text
// ILIKE` / `search_tsv @@` and falls back to a default selectivity, so
// EXPLAIN Plan Rows is worthless here — route to the capped-exact count.
const FUZZY_OPS: ReadonlySet<string> = new Set([
  'contains',
  'ncontains',
  'startsWith',
  'endsWith',
]);

function requiresExactCount(
  filter: FilterNode | undefined,
  search: SearchSpec | undefined,
): boolean {
  if (search) return true;
  if (!filter) return false;
  return filterHasFuzzyOp(filter);
}

function filterHasFuzzyOp(node: FilterNode): boolean {
  if ('children' in node) {
    return node.children.some(filterHasFuzzyOp);
  }
  return FUZZY_OPS.has((node as Condition).op);
}
