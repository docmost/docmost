import { IBaseProperty } from "@/ee/base/types/base.types";
import { useEditableTextCell } from "@/ee/base/hooks/use-editable-text-cell";
import { AutoTooltipText } from "@/components/ui/auto-tooltip-text";
import cellClasses from "@/ee/base/styles/cells.module.css";
import gridClasses from "@/ee/base/styles/grid.module.css";

type CellTextProps = {
  value: unknown;
  property: IBaseProperty;
  rowId: string;
  isEditing: boolean;
  onCommit: (value: unknown) => void;
  onCancel: () => void;
};

const toDraft = (value: unknown) => (typeof value === "string" ? value : "");
const parse = (draft: string) => draft;

export function CellText({ value, property, rowId, isEditing, onCommit, onCancel }: CellTextProps) {
  const { draft, setDraft, inputRef, handleKeyDown, handleBlur } =
    useEditableTextCell({
      value,
      isEditing,
      onCommit,
      onCancel,
      toDraft,
      parse,
      rowId,
      propertyId: property.id,
    });

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        className={cellClasses.cellInput}
        value={draft}
        maxLength={1000}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
      />
    );
  }

  const displayValue = toDraft(value);
  if (!displayValue) {
    return <span className={cellClasses.emptyValue} />;
  }
  return (
    <AutoTooltipText
      className={gridClasses.cellContent}
      fz="sm"
      tooltipProps={{ withinPortal: true }}
    >
      {displayValue}
    </AutoTooltipText>
  );
}
