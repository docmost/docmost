import { useCallback } from "react";
import { Checkbox } from "@mantine/core";
import { IBaseProperty } from "@/ee/base/types/base.types";
import cellClasses from "@/ee/base/styles/cells.module.css";

type CellCheckboxProps = {
  value: unknown;
  property: IBaseProperty;
  rowId: string;
  isEditing: boolean;
  readOnly?: boolean;
  onCommit: (value: unknown) => void;
  onCancel: () => void;
};

export function CellCheckbox({ value, readOnly, onCommit }: CellCheckboxProps) {
  const checked = value === true;

  const handleChange = useCallback(() => {
    if (readOnly) return;
    onCommit(!checked);
  }, [readOnly, checked, onCommit]);

  return (
    <div
      className={cellClasses.checkboxCell}
      onClick={handleChange}
      style={readOnly ? { cursor: "default" } : undefined}
    >
      <Checkbox
        checked={checked}
        onChange={() => {}}
        size="xs"
        tabIndex={-1}
        styles={{
          input: {
            cursor: readOnly ? "default" : "pointer",
            pointerEvents: "none",
          },
        }}
      />
    </div>
  );
}
