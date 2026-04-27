// apps/server/src/core/base/tasks/base-formula-recompute.task.ts
import { Logger } from "@nestjs/common";
import { KyselyDB, KyselyTransaction } from "@docmost/db/types/kysely.types";
import { BaseRowRepo } from "@docmost/db/repos/base/base-row.repo";
import { BasePropertyRepo } from "@docmost/db/repos/base/base-property.repo";
import {
  BaseFormulaGraph,
  evaluate,
  registry,
  DEFAULT_MAX_DEPTH,
  makeErrorCell,
  type FormulaAST,
  type FormulaTypeOptions,
  type PropertyLookup,
  type Value,
} from "@docmost/base-formula/server";
import { IBaseFormulaRecomputeJob } from "../../../integrations/queue/constants/queue.interface";

const logger = new Logger("BaseFormulaRecomputeTask");
const CHUNK_SIZE = 500;

export async function processBaseFormulaRecompute(
  db: KyselyDB,
  baseRowRepo: BaseRowRepo,
  basePropertyRepo: BasePropertyRepo,
  data: IBaseFormulaRecomputeJob,
  opts?: {
    progress?: (processed: number) => Promise<void> | void;
    onBatch?: (batch: Array<{ id: string; patch: Record<string, Value> }>) => Promise<void> | void;
    trx?: KyselyTransaction;
  },
): Promise<{ processed: number; errored: number }> {
  const { pageId, workspaceId, propertyIds, rowIds } = data;
  const properties = await basePropertyRepo.findByPageId(pageId);
  const targets = properties.filter(
    (p) => p.type === "formula" && propertyIds.includes(p.id),
  );
  if (targets.length === 0) return { processed: 0, errored: 0 };

  const graph = new BaseFormulaGraph(properties);
  const evalOrder = graph.evalOrder().filter((id) => targets.some((t) => t.id === id));
  const propertyLookup: ReadonlyMap<string, PropertyLookup> = new Map(
    properties.map((p) => [p.id, { id: p.id, type: p.type, typeOptions: p.typeOptions }]),
  );

  let processed = 0;
  let errored = 0;

  for await (const chunk of baseRowRepo.streamByPageId(pageId, {
    workspaceId,
    chunkSize: CHUNK_SIZE,
    trx: opts?.trx,
  })) {
    const updates: Array<{ id: string; patch: Record<string, Value> }> = [];
    for (const row of chunk) {
      if (rowIds && !rowIds.includes(row.id)) continue;
      const cells = (row.cells ?? {}) as Record<string, unknown>;
      const ctx = {
        registry,
        properties: propertyLookup,
        depth: 0,
        maxDepth: DEFAULT_MAX_DEPTH,
        memo: new Map<string, Value>(),
      };
      const patch: Record<string, Value> = {};
      let rowErrored = false;
      for (const propId of evalOrder) {
        const prop = propertyLookup.get(propId);
        if (!prop || prop.type !== "formula") continue;
        const ast = (prop.typeOptions as FormulaTypeOptions).ast as FormulaAST;
        try {
          patch[propId] = evaluate(ast, { ...cells, ...patch }, ctx);
        } catch (e) {
          patch[propId] = makeErrorCell("TYPE_MISMATCH", (e as Error).message);
          rowErrored = true;
        }
        if (typeof patch[propId] === "object" && patch[propId] !== null && "__err" in (patch[propId] as object)) {
          rowErrored = true;
        }
      }
      if (Object.keys(patch).length > 0) {
        updates.push({ id: row.id, patch });
      }
      processed++;
      if (rowErrored) errored++;
    }

    if (updates.length > 0) {
      // batchUpdateCells already uses coalesce(actorId, last_updated_by_id),
      // so passing actorId: undefined preserves last_updated_by_id while still
      // bumping updated_at — matches spec "only lastEditedAt moves".
      await baseRowRepo.batchUpdateCells(updates, {
        pageId,
        workspaceId,
        actorId: undefined,
        trx: opts?.trx,
      });
      await opts?.onBatch?.(updates);
    }

    await opts?.progress?.(processed);
  }

  logger.log(
    `formula-recompute base=${pageId} props=${propertyIds.join(",")} processed=${processed} errored=${errored}`,
  );
  return { processed, errored };
}
