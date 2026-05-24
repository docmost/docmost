import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { InjectQueue } from '@nestjs/bullmq';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Queue } from 'bullmq';
import { sql, SqlBool } from 'kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { executeTx } from '@docmost/db/utils';
import { BasePropertyRepo } from '@docmost/db/repos/base/base-property.repo';
import { BaseRowRepo } from '@docmost/db/repos/base/base-row.repo';
import { BaseRepo } from '@docmost/db/repos/base/base.repo';
import { BaseViewRepo } from '@docmost/db/repos/base/base-view.repo';
import { stripPropertyFromViewConfig } from './strip-property-from-view-config';
import { CreatePropertyDto } from '../dto/create-property.dto';
import {
  UpdatePropertyDto,
  DeletePropertyDto,
  ReorderPropertyDto,
} from '../dto/update-property.dto';
import {
  BasePropertyType,
  BasePropertyTypeValue,
  parseTypeOptions,
  validateTypeOptions,
  isSystemPropertyType,
} from '../base.schemas';
import { generateJitteredKeyBetween } from 'fractional-indexing-jittered';
import { QueueJob, QueueName } from '../../../integrations/queue/constants';
import {
  IBaseCellGcJob,
  IBaseTypeConversionJob,
} from '../../../integrations/queue/constants/queue.interface';
import { EventName } from '../../../common/events/event.contants';
import {
  BasePropertyCreatedEvent,
  BasePropertyDeletedEvent,
  BasePropertyReorderedEvent,
  BasePropertyUpdatedEvent,
  BaseSchemaBumpedEvent,
  BaseViewUpdatedEvent,
} from '../events/base-events';
import { processBaseTypeConversion } from '../tasks/base-type-conversion.task';
import { FormulaService } from '../formula/formula.service';
import { BaseFormulaGraph } from '@docmost/base-formula/server';


/*
 * Row-count cutoff below which the cell rewrite runs synchronously inside
 * the HTTP request. Chosen so even worst-case (file → text with attachment
 * name joins) completes comfortably under the default 30s request timeout.
 * Larger bases fall back to the BullMQ worker path which flips the type
 * only after the rewrite completes, showing a "Converting…" header state
 * in the meantime.
 */
const INLINE_CONVERSION_ROW_LIMIT = 2000;

@Injectable()
export class BasePropertyService {
  private readonly logger = new Logger(BasePropertyService.name);

  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly basePropertyRepo: BasePropertyRepo,
    private readonly baseRowRepo: BaseRowRepo,
    private readonly baseRepo: BaseRepo,
    private readonly baseViewRepo: BaseViewRepo,
    @InjectQueue(QueueName.BASE_QUEUE) private readonly baseQueue: Queue,
    private readonly eventEmitter: EventEmitter2,
    private readonly formulaService: FormulaService,
  ) {}

  async create(workspaceId: string, dto: CreatePropertyDto, actorId?: string) {
    const type = dto.type as BasePropertyTypeValue;

    await this.ensureNameUnique(dto.pageId, dto.name);

    let validatedTypeOptions: unknown;
    if (type === 'formula') {
      const sourceCandidate = (dto.typeOptions as any)?.source;
      if (typeof sourceCandidate !== 'string') {
        throw new BadRequestException('formula.source is required');
      }
      const existing = await this.basePropertyRepo.findByPageId(dto.pageId);
      const compiled = this.formulaService.compile(sourceCandidate, existing);
      const candidate = {
        id: 'pending',
        type: 'formula',
        typeOptions: compiled,
      } as any;
      const cycle = this.formulaService.detectCycle(candidate, existing);
      if (cycle) throw new BadRequestException({ code: 'CYCLE', path: cycle });
      validatedTypeOptions = compiled;
    } else {
      validatedTypeOptions = dto.typeOptions
        ? parseTypeOptionsOrThrow(type, dto.typeOptions)
        : parseTypeOptionsOrThrow(type, {});
    }

    const lastPosition = await this.basePropertyRepo.getLastPosition(
      dto.pageId,
    );
    const position = generateJitteredKeyBetween(lastPosition, null);

    const created = await executeTx(this.db, async (trx) => {
      const row = await this.basePropertyRepo.insertProperty(
        {
          pageId: dto.pageId,
          name: dto.name,
          type: dto.type,
          position,
          typeOptions: validatedTypeOptions as any,
          workspaceId,
        },
        trx,
      );
      await this.baseRepo.bumpSchemaVersion(dto.pageId, trx);
      return row;
    });

    const event: BasePropertyCreatedEvent = {
      pageId: dto.pageId,
      workspaceId,
      actorId: actorId ?? null,
      requestId: null,
      property: created,
    };
    this.eventEmitter.emit(EventName.BASE_PROPERTY_CREATED, event);

    if (created.type === 'formula') {
      await this.formulaService.enqueueRecompute({
        pageId: created.pageId,
        workspaceId,
        propertyIds: [created.id],
        reason: 'formula_created',
        actorId: actorId ?? null,
      });
    }

    return created;
  }

  /*
   * Metadata update. Three paths:
   *
   *  - Coercion-safe (number↔text, text↔url, etc.): flip the type/type
   *    options in one transaction, bump schema_version, return. The engine
   *    reads cells through schema-on-read extractors so no cell rewrite is
   *    needed.
   *  - ID-referencing or system-involving conversion with a small number
   *    of rows: run the cell rewrite, flip the type, and bump
   *    schema_version all in one transaction — the HTTP request waits but
   *    nobody ever sees raw IDs under the new type.
   *  - Same kind of conversion on a large base: stage the target type on
   *    `pendingType` / `pendingTypeOptions`, keep the live `type` as-is,
   *    enqueue the worker. Clients render under the old type (so cells
   *    resolve to display names, not UUIDs) and show a "Converting…"
   *    badge until the worker transaction commits and swaps the pending
   *    pair onto `type`.
   */
  async update(
    dto: UpdatePropertyDto,
    workspaceId: string,
    actorId?: string,
  ) {
    const t0 = Date.now();
    const tick = (label: string) =>
      this.logger.log(
        `property-update ${dto.propertyId} ${label}=${Date.now() - t0}ms`,
      );

    const property = await this.basePropertyRepo.findById(dto.propertyId);
    tick('after-findById');
    if (!property) {
      throw new NotFoundException('Property not found');
    }

    if (property.pageId !== dto.pageId) {
      throw new BadRequestException('Property does not belong to this base');
    }

    if (dto.name !== undefined) {
      await this.ensureNameUnique(dto.pageId, dto.name, dto.propertyId);
    }

    // Block competing type / typeOptions edits — the worker still owns
    // the previous conversion. A name-only rename is safe and passes
    // through; it doesn't touch the type/cells the worker is rewriting.
    if (
      property.pendingType &&
      (dto.type !== undefined || dto.typeOptions !== undefined)
    ) {
      throw new ConflictException(
        'A type conversion is already in progress for this property',
      );
    }

    const isTypeChange = dto.type && dto.type !== property.type;
    const oldType = property.type as BasePropertyTypeValue;
    const oldTypeOptions = property.typeOptions;
    const newType = (dto.type ?? property.type) as BasePropertyTypeValue;

    if (isTypeChange && isSystemPropertyType(oldType)) {
      throw new BadRequestException(
        'Cannot change the type of a system property',
      );
    }
    if (
      isTypeChange &&
      property.isPrimary &&
      newType !== BasePropertyType.TEXT
    ) {
      throw new BadRequestException('The primary property must be text');
    }

    // --- Formula-specific type-option compilation ---------------------------
    // If the update is a formula (either staying a formula and editing source,
    // or converting TO formula), compile the source, cycle-check, and replace
    // `dto.typeOptions` with the canonical FormulaTypeOptions.
    const isFormulaTarget = newType === 'formula';
    const sourceChanged =
      isFormulaTarget &&
      typeof (dto.typeOptions as any)?.source === 'string' &&
      (dto.typeOptions as any).source !==
        (property.typeOptions as any)?.source;

    if (isFormulaTarget && (isTypeChange || sourceChanged)) {
      const sourceCandidate = (dto.typeOptions as any)?.source;
      if (typeof sourceCandidate !== 'string') {
        throw new BadRequestException('formula.source is required');
      }
      const allProps = await this.basePropertyRepo.findByPageId(dto.pageId);
      const compiled = this.formulaService.compile(sourceCandidate, allProps);
      const candidate = {
        id: property.id,
        type: 'formula' as const,
        typeOptions: compiled,
      } as any;
      const cycle = this.formulaService.detectCycle(candidate, allProps);
      if (cycle) throw new BadRequestException({ code: 'CYCLE', path: cycle });
      // Normalize dto.typeOptions to the compiled envelope so the rest of
      // update() flows through Path 1 without further parsing.
      dto.typeOptions = compiled as any;
    }

    let validatedTypeOptions = property.typeOptions;
    if (dto.typeOptions !== undefined) {
      validatedTypeOptions = parseTypeOptionsOrThrow(
        newType,
        dto.typeOptions,
      ) as any;
    } else if (isTypeChange) {
      const result = validateTypeOptions(newType, {});
      validatedTypeOptions = result.success ? (result.data as any) : null;
    }

    const involvesSystem =
      isSystemPropertyType(oldType) || isSystemPropertyType(newType);
    const needsCellRewrite = isTypeChange;

    // --- Path 1: no cell rewrite needed ---------------------------------
    if (!needsCellRewrite) {
      await executeTx(this.db, async (trx) => {
        await this.basePropertyRepo.updateProperty(
          dto.propertyId,
          {
            ...(dto.name !== undefined && { name: dto.name }),
            ...(dto.type !== undefined && { type: dto.type }),
            typeOptions: validatedTypeOptions,
          },
          trx,
        );
        if (isTypeChange) {
          await this.basePropertyRepo.bumpSchemaVersion(dto.propertyId, trx);
          await this.baseRepo.bumpSchemaVersion(dto.pageId, trx);
        }
      });

      if (newType === 'formula' && (isTypeChange || sourceChanged)) {
        await this.formulaService.enqueueRecompute({
          pageId: dto.pageId,
          workspaceId,
          propertyIds: [dto.propertyId],
          reason: isTypeChange ? 'formula_created' : 'formula_edited',
          actorId: actorId ?? null,
        });
      }

      if (isTypeChange && newType !== 'formula') {
        const allProps = await this.basePropertyRepo.findByPageId(dto.pageId);
        const graph = new BaseFormulaGraph(allProps);
        const affected = graph.affectedFormulas([dto.propertyId]);
        if (affected.length > 0) {
          await this.formulaService.enqueueRecompute({
            pageId: dto.pageId,
            workspaceId,
            propertyIds: affected,
            reason: 'dep_type_changed',
            actorId: actorId ?? null,
          });
        }
      }

      return this.loadAndEmit(dto, workspaceId, actorId, null);
    }

    // --- Path 2 or 3: cell rewrite needed -------------------------------
    const conversionPayload: IBaseTypeConversionJob = {
      pageId: dto.pageId,
      propertyId: dto.propertyId,
      workspaceId,
      fromType: oldType,
      toType: newType,
      fromTypeOptions: oldTypeOptions,
      toTypeOptions: validatedTypeOptions,
      clearMode: involvesSystem,
      actorId,
    };

    // Count only the rows whose cell jsonb has this property's key — the
    // set the worker will actually rewrite. A 100k-row base with the
    // property set on 12 rows is trivial to convert inline; the previous
    // count-all-live-rows check was routing those to the worker.
    const rowsToConvert = await this.countRowsToConvert(
      dto.pageId,
      workspaceId,
      dto.propertyId,
    );
    tick(`after-countRowsToConvert(${rowsToConvert})`);

    if (rowsToConvert <= INLINE_CONVERSION_ROW_LIMIT) {
      tick('taking-inline-path');
      // Path 2: inline rewrite. Apply the name-only fields (if any), run
      // the rewrite, then flip the type — all in one transaction so
      // readers only ever see a consistent snapshot.
      const schemaVersion = await executeTx(this.db, async (trx) => {
        if (dto.name !== undefined) {
          await this.basePropertyRepo.updateProperty(
            dto.propertyId,
            { name: dto.name },
            trx,
          );
        }
        await processBaseTypeConversion(
          this.db,
          this.baseRowRepo,
          conversionPayload,
          { trx },
        );
        await this.basePropertyRepo.updateProperty(
          dto.propertyId,
          {
            type: newType,
            typeOptions: validatedTypeOptions,
          },
          trx,
        );
        await this.basePropertyRepo.bumpSchemaVersion(dto.propertyId, trx);
        return this.baseRepo.bumpSchemaVersion(dto.pageId, trx);
      });
      tick('inline-tx-done');
      const bumpEvent: BaseSchemaBumpedEvent = {
        pageId: dto.pageId,
        workspaceId,
        actorId: actorId ?? null,
        requestId: null,
        schemaVersion,
      };
      this.eventEmitter.emit(EventName.BASE_SCHEMA_BUMPED, bumpEvent);
      return this.loadAndEmit(dto, workspaceId, actorId, null);
    }

    // Path 3: stage the new type on pending_*, keep live `type` alone,
    // and hand off to the worker. A best-effort revert clears the staging
    // fields if the enqueue itself fails.
    tick('taking-worker-path');
    await executeTx(this.db, async (trx) => {
      await this.basePropertyRepo.updateProperty(
        dto.propertyId,
        {
          ...(dto.name !== undefined && { name: dto.name }),
          pendingType: newType,
          pendingTypeOptions: validatedTypeOptions,
        },
        trx,
      );
    });
    tick('after-set-pending');

    let jobId: string | null = null;
    try {
      const job = await this.baseQueue.add(
        QueueJob.BASE_TYPE_CONVERSION,
        conversionPayload,
        { attempts: 1 },
      );
      jobId = String(job.id);
      tick(`after-queue.add(${jobId})`);
    } catch (err) {
      this.logger.error(
        `Enqueue of type-conversion failed for property ${dto.propertyId}; clearing pending state`,
        err as Error,
      );
      try {
        await this.basePropertyRepo.clearPendingTypeChange(dto.propertyId);
      } catch (revertErr) {
        this.logger.error(
          `Failed to clear pending state on ${dto.propertyId}. Manual intervention required.`,
          revertErr as Error,
        );
      }
      throw new ServiceUnavailableException(
        'Type conversion queue unavailable. Property update rolled back.',
      );
    }

    const out = await this.loadAndEmit(dto, workspaceId, actorId, jobId);
    tick('return');
    return out;
  }

  /*
   * Reloads the property and emits `base.property.updated`. The emission
   * has to happen after the outer transaction commits so socket consumers
   * never race ahead of visibility.
   */
  private async ensureNameUnique(
    pageId: string,
    candidate: string,
    excludePropertyId?: string,
  ): Promise<void> {
    const trimmed = candidate.trim();
    if (!trimmed) return;
    const existing = await this.basePropertyRepo.findByPageId(pageId);
    const lower = trimmed.toLowerCase();
    const clash = existing.find(
      (p) =>
        p.id !== excludePropertyId &&
        p.name.trim().toLowerCase() === lower,
    );
    if (clash) {
      throw new BadRequestException(
        `A property named "${trimmed}" already exists in this base`,
      );
    }
  }

  private async loadAndEmit(
    dto: UpdatePropertyDto,
    workspaceId: string,
    actorId: string | undefined,
    jobId: string | null,
  ) {
    const updated = await this.basePropertyRepo.findById(dto.propertyId);
    if (updated) {
      const event: BasePropertyUpdatedEvent = {
        pageId: dto.pageId,
        workspaceId,
        actorId: actorId ?? null,
        requestId: dto.requestId ?? null,
        property: updated,
        schemaVersion: updated.schemaVersion,
      };
      this.eventEmitter.emit(EventName.BASE_PROPERTY_UPDATED, event);
    }
    return { property: updated, jobId };
  }

  private async countRowsToConvert(
    pageId: string,
    workspaceId: string,
    propertyId: string,
  ): Promise<number> {
    const row = await this.db
      .selectFrom('baseRows')
      .select(sql<string>`count(*)`.as('n'))
      .where('pageId', '=', pageId)
      .where('workspaceId', '=', workspaceId)
      .where('deletedAt', 'is', null)
      .where(sql<SqlBool>`cells ? ${propertyId}`)
      .executeTakeFirst();
    return Number(row?.n ?? 0);
  }

  async delete(
    dto: DeletePropertyDto,
    workspaceId: string,
    actorId?: string,
  ) {
    const property = await this.basePropertyRepo.findById(dto.propertyId);
    if (!property) {
      throw new NotFoundException('Property not found');
    }

    if (property.pageId !== dto.pageId) {
      throw new BadRequestException('Property does not belong to this base');
    }

    if (property.isPrimary) {
      throw new BadRequestException('Cannot delete the primary property');
    }

    if (property.pendingType) {
      throw new ConflictException(
        'Cannot delete a property while a type conversion is in progress',
      );
    }

    // Compute dependents BEFORE the delete — once soft-deleted the graph
    // wouldn't include them.
    const allProps = await this.basePropertyRepo.findByPageId(dto.pageId);
    const graph = new BaseFormulaGraph(allProps);
    const affected = graph.affectedFormulas([dto.propertyId]);

    // Soft-delete so queries filter the property out immediately, then
    // enqueue cell-gc to scrub cell keys and hard-delete. If the enqueue
    // fails, revert the soft-delete so the property isn't orphaned.
    // In the same transaction, strip the deleted property's id out of
    // every view's config (sorts, filters, groupBy) so views don't render
    // dangling references after the delete commits.
    const updatedViewIds: string[] = [];
    await executeTx(this.db, async (trx) => {
      await this.basePropertyRepo.softDelete(dto.propertyId, trx);
      await this.baseRepo.bumpSchemaVersion(dto.pageId, trx);

      const views = await this.baseViewRepo.findByPageId(dto.pageId, {
        workspaceId,
        trx,
      });
      for (const view of views) {
        const before = (view.config ?? {}) as Record<string, unknown>;
        const next = stripPropertyFromViewConfig(
          view.config as any,
          dto.propertyId,
        );
        const after = next as Record<string, unknown>;
        if (
          Object.keys(before).length === Object.keys(after).length &&
          Object.keys(before).every((k) => k in after) &&
          JSON.stringify(before) === JSON.stringify(after)
        ) {
          continue;
        }
        await this.baseViewRepo.updateView(
          view.id,
          { config: next as any },
          { workspaceId, trx },
        );
        updatedViewIds.push(view.id);
      }
    });

    for (const viewId of updatedViewIds) {
      const fresh = await this.baseViewRepo.findById(viewId, { workspaceId });
      if (fresh) {
        const event: BaseViewUpdatedEvent = {
          pageId: dto.pageId,
          workspaceId,
          actorId: actorId ?? null,
          requestId: dto.requestId ?? null,
          view: fresh,
        };
        this.eventEmitter.emit(EventName.BASE_VIEW_UPDATED, event);
      }
    }

    const payload: IBaseCellGcJob = {
      pageId: dto.pageId,
      propertyId: dto.propertyId,
      workspaceId,
    };
    try {
      await this.baseQueue.add(QueueJob.BASE_CELL_GC, payload, { attempts: 2 });
    } catch (err) {
      this.logger.error(
        `Enqueue of cell-gc failed for property ${dto.propertyId}; reverting soft-delete`,
        err as Error,
      );
      try {
        await this.basePropertyRepo.updateProperty(dto.propertyId, {
          deletedAt: null,
        });
      } catch (revertErr) {
        this.logger.error(
          `Revert failed for property ${dto.propertyId}. Manual intervention required.`,
          revertErr as Error,
        );
      }
      throw new ServiceUnavailableException(
        'Cell-GC queue unavailable. Property delete rolled back.',
      );
    }

    const event: BasePropertyDeletedEvent = {
      pageId: dto.pageId,
      workspaceId,
      actorId: actorId ?? null,
      requestId: dto.requestId ?? null,
      propertyId: dto.propertyId,
    };
    this.eventEmitter.emit(EventName.BASE_PROPERTY_DELETED, event);

    if (affected.length > 0) {
      await this.formulaService.enqueueRecompute({
        pageId: dto.pageId,
        workspaceId,
        propertyIds: affected,
        reason: 'dep_deleted',
        actorId: actorId ?? null,
      });
    }
  }

  async reorder(
    dto: ReorderPropertyDto,
    workspaceId: string,
    actorId?: string,
  ) {
    const property = await this.basePropertyRepo.findById(dto.propertyId);
    if (!property) {
      throw new NotFoundException('Property not found');
    }

    if (property.pageId !== dto.pageId) {
      throw new BadRequestException('Property does not belong to this base');
    }

    await this.basePropertyRepo.updateProperty(dto.propertyId, {
      position: dto.position,
    });

    const event: BasePropertyReorderedEvent = {
      pageId: dto.pageId,
      workspaceId,
      actorId: actorId ?? null,
      requestId: dto.requestId ?? null,
      propertyId: dto.propertyId,
      position: dto.position,
    };
    this.eventEmitter.emit(EventName.BASE_PROPERTY_REORDERED, event);
  }
}

function parseTypeOptionsOrThrow(
  type: BasePropertyTypeValue,
  typeOptions: unknown,
): unknown {
  try {
    return parseTypeOptions(type, typeOptions);
  } catch (err) {
    throw new BadRequestException({
      message: 'Invalid typeOptions',
      issues: (err as any)?.issues ?? [],
    });
  }
}
