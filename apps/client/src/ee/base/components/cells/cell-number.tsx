import {
  IBaseProperty,
  NumberTypeOptions,
} from "@/ee/base/types/base.types";
import { formatCurrency } from "@/ee/base/constants/currencies";
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

export function formatNumber(
  val: number | null | undefined,
  options: NumberTypeOptions | undefined,
): string {
  if (val == null) return "";
  const precision = options?.precision ?? 0;
  const format = options?.format ?? "plain";

  switch (format) {
    case "separators":
      return new Intl.NumberFormat(undefined, {
        minimumFractionDigits: precision,
        maximumFractionDigits: precision,
      }).format(val);
    case "currency":
      return formatCurrency(val, options?.currencyCode, options?.precision);
    case "percent":
      return `${val.toFixed(precision)}%`;
    case "progress":
      return `${Math.min(100, Math.max(0, val)).toFixed(0)}%`;
    default:
      return precision > 0 ? val.toFixed(precision) : String(val);
  }
}

const toDraft = (value: unknown) =>
  typeof value === "number" ? String(value) : "";

const parse = (draft: string) => {
  const parsed = draft === "" ? null : Number(draft);
  return parsed != null && isNaN(parsed) ? null : parsed;
};

export function CellNumber({
  value,
  property,
  isEditing,
  onCommit,
  onCancel,
}: CellNumberProps) {
  const typeOptions = property.typeOptions as NumberTypeOptions | undefined;
  const { draft, setDraft, inputRef, handleKeyDown, handleBlur } =
    useEditableTextCell({ value, isEditing, onCommit, onCancel, toDraft, parse });

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
