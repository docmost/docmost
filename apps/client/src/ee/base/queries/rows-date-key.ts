import type { FilterNode } from "@/ee/base/types/base.types";
import type { ViewerDateContext } from "@/ee/base/hooks/use-viewer-date-context";

export type RowsDateKey = { timeZone: string; today?: string; weekStart?: number };

type Operand = { mode: string; preset?: unknown };

const OPERAND_MODES = new Set(["exact", "relative", "range"]);

function isOperand(value: unknown): value is Operand {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    OPERAND_MODES.has((value as Operand).mode)
  );
}

function collectOperands(node: FilterNode, found: Operand[]): Operand[] {
  if ("children" in node) {
    node.children.forEach((child) => collectOperands(child, found));
  } else if (isOperand(node.value)) {
    found.push(node.value);
  }
  return found;
}

export function rowsDateKey(
  filter: FilterNode | undefined,
  viewer: ViewerDateContext,
): RowsDateKey | undefined {
  if (!filter) return undefined;
  const operands = collectOperands(filter, []);
  if (operands.length === 0) return undefined;
  const key: RowsDateKey = { timeZone: viewer.timeZone };
  if (operands.some((o) => o.mode === "relative" || o.mode === "range")) {
    key.today = viewer.today;
  }
  if (operands.some((o) => o.mode === "range" && o.preset === "thisWeek")) {
    key.weekStart = viewer.weekStart;
  }
  return key;
}
