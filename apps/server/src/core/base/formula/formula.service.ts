import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import {
  BaseFormulaGraph,
  evaluate,
  registry,
  parseRaw,
  resolve,
  typecheck,
  DEFAULT_MAX_DEPTH,
  makeErrorCell,
  type FormulaAST,
  type FormulaTypeOptions,
  type PropertyLookup,
  type Value,
} from "@docmost/base-formula/server";
import {
  QueueJob,
  QueueName,
} from "../../../integrations/queue/constants";
import { IBaseFormulaRecomputeJob } from "../../../integrations/queue/constants/queue.interface";
import { BaseProperty } from "@docmost/db/types/entity.types";
import { FormulaParseError } from "@docmost/base-formula/server";
import { FORMULA_INLINE_ROW_THRESHOLD } from "./formula.constants";

@Injectable()
export class FormulaService {
  private readonly logger = new Logger(FormulaService.name);

  constructor(
    @InjectQueue(QueueName.BASE_QUEUE) private readonly queue: Queue,
  ) {}

  get inlineThreshold(): number { return FORMULA_INLINE_ROW_THRESHOLD; }

  /*
   * Parses a raw source string against the given property set. Used by the
   * property create/update service when a formula is saved. Returns the
   * canonical FormulaTypeOptions ready to persist, or throws a
   * BadRequestException built from the parse errors.
   */
  compile(source: string, properties: BaseProperty[]): FormulaTypeOptions {
    const nameToId = new Map(properties.map((p) => [p.name, p.id]));
    try {
      const raw = parseRaw(source);
      const resolved = resolve(raw, nameToId);
      const typeMap = new Map(
        properties.map((p) => [p.id, asResultType(p.type)]),
      );
      const { resultType } = typecheck(resolved.ast, typeMap, registry);
      return {
        source,
        ast: resolved.ast,
        resultType,
        dependencies: resolved.dependencies,
        astVersion: 1,
      };
    } catch (e) {
      if (e instanceof FormulaParseError) {
        throw new BadRequestException({ message: "Invalid formula", errors: e.errors });
      }
      throw e;
    }
  }

  /*
   * Returns the cycle path if the candidate property (post-edit) would
   * introduce a cycle, else null. Used before save.
   */
  detectCycle(candidate: BaseProperty, allProperties: BaseProperty[]): string[] | null {
    const others = allProperties.filter((p) => p.id !== candidate.id);
    const graph = new BaseFormulaGraph([...others, candidate]);
    return graph.detectCycle(candidate);
  }

  /*
   * Same-row inline evaluation. Returns a patch containing only the cells
   * that changed (or errored) due to formula evaluation. Caller merges
   * into the user-provided patch and persists.
   */
  evaluateInline(args: {
    properties: BaseProperty[];
    row: Record<string, unknown>;
    dirtyProps: string[];
  }): Record<string, Value> {
    const graph = new BaseFormulaGraph(args.properties);
    const affected = graph.affectedFormulas(args.dirtyProps);
    if (affected.length === 0) return {};

    const ctx = {
      registry,
      properties: this.buildPropertyLookup(args.properties),
      depth: 0,
      maxDepth: DEFAULT_MAX_DEPTH,
      memo: new Map<string, Value>(),
    };

    const order = graph.evalOrder().filter((id) => affected.includes(id));
    const patch: Record<string, Value> = {};
    for (const propId of order) {
      const prop = args.properties.find((p) => p.id === propId);
      if (!prop || prop.type !== "formula") continue;
      const opts = prop.typeOptions as FormulaTypeOptions;
      try {
        patch[propId] = evaluate(opts.ast as FormulaAST, { ...args.row, ...patch }, ctx);
      } catch (e) {
        patch[propId] = makeErrorCell("TYPE_MISMATCH", (e as Error).message);
      }
    }
    return patch;
  }

  /*
   * Enqueue a full recompute for the given formula property IDs on the given
   * base. Reasons let the worker log why the job ran. Job ID includes baseId
   * so BullMQ will dedupe when the same base has multiple edits in flight —
   * see FormulaLock for the per-base Redis serialization.
   */
  async enqueueRecompute(args: IBaseFormulaRecomputeJob): Promise<void> {
    await this.queue.add(QueueJob.BASE_FORMULA_RECOMPUTE, args, {
      jobId: `formula-recompute:${args.baseId}:${Date.now()}`,
      removeOnComplete: 1000,
      removeOnFail: 1000,
    });
  }

  private buildPropertyLookup(props: BaseProperty[]): ReadonlyMap<string, PropertyLookup> {
    return new Map(props.map((p) => [p.id, {
      id: p.id,
      type: p.type,
      typeOptions: p.typeOptions,
    }]));
  }
}

function asResultType(type: string): "number" | "string" | "boolean" | "date" | "null" {
  if (type === "number") return "number";
  if (type === "text" || type === "url" || type === "email") return "string";
  if (type === "checkbox") return "boolean";
  if (type === "date" || type === "createdAt" || type === "lastEditedAt") return "date";
  if (type === "formula") return "number"; // overridden by the nested formula's own resultType at runtime
  return "null";
}
