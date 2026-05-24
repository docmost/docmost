import { useState, useCallback } from "react";
import { Group, Text } from "@mantine/core";
import { IBaseProperty, IBaseRow } from "@/features/base/types/base.types";
import { CellRenderer } from "@/features/base/components/cells/cell-renderer";

type PropertyRowProps = {
  property: IBaseProperty;
  row: IBaseRow;
  onUpdate: (propertyId: string, value: unknown) => void;
};

export function PropertyRow({ property, row, onUpdate }: PropertyRowProps) {
  const value = (row.cells ?? {})[property.id];
  // The cell components key their edit state off `isEditing`. In the
  // modal we treat the cell as always-active: click to commit a new
  // value, blur/escape to commit-or-cancel the same way the grid does.
  const [editing, setEditing] = useState(false);

  const handleCommit = useCallback(
    (next: unknown) => {
      setEditing(false);
      onUpdate(property.id, next);
    },
    [onUpdate, property.id],
  );
  const handleCancel = useCallback(() => setEditing(false), []);

  return (
    <Group
      align="flex-start"
      wrap="nowrap"
      gap="md"
      onClick={() => setEditing(true)}
      style={{ cursor: "text" }}
    >
      <div style={{ width: 140, flex: "0 0 140px", paddingTop: 6 }}>
        <Text size="sm" c="dimmed">
          {property.name}
        </Text>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <CellRenderer
          property={property}
          rowId={row.id}
          value={value}
          isEditing={editing}
          onCommit={handleCommit}
          onCancel={handleCancel}
        />
      </div>
    </Group>
  );
}
