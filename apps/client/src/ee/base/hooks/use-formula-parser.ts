import { useEffect, useMemo, useState } from "react";
import {
  parseRaw,
  resolve,
  typecheck,
  BaseFormulaGraph,
  type FormulaResultType,
  type FormulaFn,
} from "@docmost/base-formula/client";
import type { IBaseProperty } from "@/ee/base/types/base.types";

type ParseState =
  | { state: "idle" }
  | {
      state: "ok";
      resultType: FormulaResultType;
      ast: unknown;
      dependencies: string[];
    }
  | {
      state: "error";
      code: string;
      message: string;
      span?: { start: number; end: number };
    };

export function useFormulaParser(
  source: string,
  properties: IBaseProperty[],
  editingPropertyId: string | null,
  registryForTypecheck: ReadonlyMap<string, FormulaFn>,
): ParseState {
  const [state, setState] = useState<ParseState>({ state: "idle" });

  const deps = useMemo(
    () => ({ source, properties, editingPropertyId, registryForTypecheck }),
    [source, properties, editingPropertyId, registryForTypecheck],
  );

  useEffect(() => {
    const handle = setTimeout(() => {
      if (!source.trim()) {
        setState({ state: "idle" });
        return;
      }
      try {
        const nameToId = new Map(properties.map((p) => [p.name, p.id]));
        const raw = parseRaw(source);
        const resolved = resolve(raw, nameToId);
        const typeMap = new Map<string, FormulaResultType>(
          properties.map((p) => [p.id, clientResultTypeOf(p.type)]),
        );
        const tc = typecheck(resolved.ast, typeMap, registryForTypecheck);
        const candidate = {
          id: editingPropertyId ?? "pending",
          type: "formula" as const,
          typeOptions: { dependencies: resolved.dependencies },
        };
        const others = editingPropertyId
          ? properties.filter((p) => p.id !== editingPropertyId)
          : properties;
        const graph = new BaseFormulaGraph([...others, candidate as any]);
        const cycle = graph.detectCycle(candidate as any);
        if (cycle) {
          setState({
            state: "error",
            code: "CYCLE",
            message: `Cycle: ${cycle.join(" \u2192 ")}`,
          });
          return;
        }
        setState({
          state: "ok",
          resultType: tc.resultType,
          ast: resolved.ast,
          dependencies: resolved.dependencies,
        });
      } catch (e: any) {
        const first = e?.errors?.[0];
        setState({
          state: "error",
          code: first?.code ?? "PARSE_ERROR",
          message: first?.message ?? e?.message ?? String(e),
          span: first?.span,
        });
      }
    }, 150);
    return () => clearTimeout(handle);
  }, [deps]);

  return state;
}

function clientResultTypeOf(type: string): FormulaResultType {
  if (type === "number") return "number";
  if (
    type === "text" ||
    type === "url" ||
    type === "email" ||
    type === "longText"
  )
    return "string";
  if (type === "checkbox") return "boolean";
  if (type === "date" || type === "createdAt" || type === "lastEditedAt")
    return "date";
  return "null";
}
