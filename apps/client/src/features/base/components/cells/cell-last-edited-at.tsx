import { IBaseProperty } from "@/features/base/types/base.types";
import cellClasses from "@/features/base/styles/cells.module.css";

type CellLastEditedAtProps = {
  value: unknown;
  property: IBaseProperty;
  rowId: string;
  isEditing: boolean;
  onCommit: (value: unknown) => void;
  onCancel: () => void;
};

function formatTimestamp(val: unknown): string {
  if (typeof val !== "string" || !val) return "";
  const date = new Date(val);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function CellLastEditedAt({ value }: CellLastEditedAtProps) {
  const formatted = formatTimestamp(value);

  if (!formatted) {
    return <span className={cellClasses.emptyValue} />;
  }

  return <span className={cellClasses.dateValue}>{formatted}</span>;
}
