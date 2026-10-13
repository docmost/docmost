import {
  IBaseProperty,
  NumberTypeOptions,
} from "@/ee/base/types/base.types";
import { formatCurrency } from "@/ee/base/constants/currencies";
import { snapNumber } from "@docmost/base-formula/client";
import { useEditableTextCell } from "@/ee/base/hooks/use-editable-text-cell";
import { AutoTooltipText } from "@/components/ui/auto-tooltip-text";
import cellClasses from "@/ee/base/styles/cells.module.css";

type CellNumberProps = {
  value: unknown;
  property: IBaseProperty;
  rowId: string;
  isEditing: boolean;
  onCommit: (value: unknown) => void;
  onCancel: () => void;
};

const SEPARATOR_CHARS: Record<string, { group: string; decimal: string }> = {
  comma_period: { group: ",", decimal: "." },
  period_comma: { group: ".", decimal: "," },
  space_comma: { group: " ", decimal: "," },
  space_period: { group: " ", decimal: "." },
};

function separatorChars(style: string): { group: string; decimal: string } {
  if (style === "local") {
    const parts = new Intl.NumberFormat().formatToParts(11111.1);
    return {
      group: parts.find((p) => p.type === "group")?.value ?? ",",
      decimal: parts.find((p) => p.type === "decimal")?.value ?? ".",
    };
  }
  return SEPARATOR_CHARS[style] ?? { group: ",", decimal: "." };
}

function formatPlain(
  value: number,
  precision: number | undefined,
  style: string,
): string {
  const fixed = precision == null ? String(value) : value.toFixed(precision);
  if (style === "none") return fixed;
  const { group, decimal } = separatorChars(style);
  const neg = fixed[0] === "-";
  const abs = neg ? fixed.slice(1) : fixed;
  const dot = abs.indexOf(".");
  const intPart = dot === -1 ? abs : abs.slice(0, dot);
  const fracPart = dot === -1 ? "" : abs.slice(dot + 1);
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, group);
  const out = fracPart ? `${grouped}${decimal}${fracPart}` : grouped;
  return neg ? `-${out}` : out;
}

export function formatNumber(
  val: number | null | undefined,
  options: NumberTypeOptions | undefined,
): string {
  if (val == null) return "";
  const precision = options?.precision;
  const format = options?.format ?? "plain";
  const style = options?.separators ?? "none";
  const v = precision == null ? snapNumber(val) : val;

  switch (format) {
    case "currency":
      return formatCurrency(v, options?.currencyCode, precision);
    case "percent":
      return `${formatPlain(v, precision, style)}%`;
    case "progress":
      return `${Math.min(100, Math.max(0, v)).toFixed(0)}%`;
    default:
      return formatPlain(v, precision, style);
  }
}

const toDraft = (value: unknown) =>
  typeof value === "number" ? String(value) : "";

export function sanitizeNumberInput(text: string): string {
  return text.replace(/[^0-9.-]/g, "");
}

export function parseNumberDraft(draft: string): number | null {
  const cleaned = sanitizeNumberInput(draft);
  if (cleaned === "" || cleaned === "-") return null;
  const parsed = Number(cleaned);
  return isNaN(parsed) ? null : parsed;
}

export function CellNumber({
  value,
  property,
  rowId,
  isEditing,
  onCommit,
  onCancel,
}: CellNumberProps) {
  const typeOptions = property.typeOptions as NumberTypeOptions | undefined;
  const { draft, setDraft, inputRef, handleKeyDown, handleBlur } =
    useEditableTextCell({
      value,
      isEditing,
      onCommit,
      onCancel,
      toDraft,
      parse: parseNumberDraft,
      rowId,
      propertyId: property.id,
    });

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        className={`${cellClasses.cellInput} ${cellClasses.numberInput}`}
        value={draft}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "" || v === "-" || /^-?\d*\.?\d*$/.test(v)) {
            setDraft(v);
          }
        }}
        onPaste={(e) => {
          e.preventDefault();
          const el = e.currentTarget;
          const start = el.selectionStart ?? draft.length;
          const end = el.selectionEnd ?? draft.length;
          setDraft(
            draft.slice(0, start) +
              sanitizeNumberInput(e.clipboardData.getData("text")) +
              draft.slice(end),
          );
        }}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
      />
    );
  }

  const numValue = typeof value === "number" ? value : null;
  if (numValue == null) {
    return <span className={cellClasses.emptyValue} />;
  }

  return (
    <AutoTooltipText
      className={cellClasses.numberValue}
      fz="sm"
      tooltipProps={{ withinPortal: true }}
    >
      {formatNumber(numValue, typeOptions)}
    </AutoTooltipText>
  );
}
