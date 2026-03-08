import { useCallback } from "react";
import { Checkbox } from "@mantine/core";
import { IBaseProperty } from "@/features/base/types/base.types";
import cellClasses from "@/features/base/styles/cells.module.css";

type CellCheckboxProps = {
  value: unknown;
  property: IBaseProperty;
  rowId: string;
  isEditing: boolean;
  onCommit: (value: unknown) => void;
  onCancel: () => void;
};

export function CellCheckbox({
  value,
  onCommit,
}: CellCheckboxProps) {
  const checked = value === true;

  const handleChange = useCallback(() => {
    onCommit(!checked);
  }, [checked, onCommit]);

  return (
    <div className={cellClasses.checkboxCell} onClick={handleChange}>
      <Checkbox
        checked={checked}
        onChange={() => {}}
        size="xs"
        tabIndex={-1}
        styles={{ input: { cursor: "pointer", pointerEvents: "none" } }}
      />
    </div>
  );
}
