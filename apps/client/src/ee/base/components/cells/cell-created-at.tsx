import { IBaseProperty } from "@/ee/base/types/base.types";
import { formatTimestamp } from "@/ee/base/formatters/cell-formatters";
import cellClasses from "@/ee/base/styles/cells.module.css";

type CellCreatedAtProps = {
  value: unknown;
  property: IBaseProperty;
  rowId: string;
  isEditing: boolean;
  onCommit: (value: unknown) => void;
  onCancel: () => void;
};

export function CellCreatedAt({ value }: CellCreatedAtProps) {
  const formatted = formatTimestamp(typeof value === "string" ? value : null);

  if (!formatted) {
    return <span className={cellClasses.emptyValue} />;
  }

  return <span className={cellClasses.dateValue}>{formatted}</span>;
}
