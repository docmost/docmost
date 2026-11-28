import { useEffect } from "react";
import { Popover } from "@mantine/core";
import clsx from "clsx";
import type { CellComponentProps } from "@/ee/base/property-types/property-type.descriptor";
import type { RelationTypeOptions } from "@/ee/base/types/base.types";
import { RelationReadList } from "@/ee/base/components/cells/relation-read-list";
import { RelationPicker } from "@/ee/base/components/cells/relation-picker";
import cellClasses from "@/ee/base/styles/cells.module.css";

export function CellRelation({
  property,
  rowId,
  isEditing,
  relation,
  readOnly,
  onCancel,
}: CellComponentProps) {
  const { targetBaseId } = property.typeOptions as RelationTypeOptions;
  // a row whose relation data hasn't arrived yet stays read-only until it does
  const canEdit =
    !readOnly &&
    relation !== undefined &&
    !relation.restricted &&
    relation.permissions?.canEdit !== false;

  // a cell that can't be edited hands focus straight back to the grid
  useEffect(() => {
    if (isEditing && !canEdit) onCancel();
  }, [isEditing, canEdit, onCancel]);

  const readList = <RelationReadList preview={relation} targetBaseId={targetBaseId} />;
  if (!isEditing || !canEdit) return readList;

  return (
    <Popover
      opened
      onChange={(o) => {
        if (!o) onCancel();
      }}
      onClose={onCancel}
      position="bottom-start"
      width={320}
      trapFocus
      closeOnClickOutside
      closeOnEscape
      hideDetached={false}
    >
      <Popover.Target>
        <div className={clsx(cellClasses.popoverTargetFlex, cellClasses.relationEditTarget)}>
          {readList}
        </div>
      </Popover.Target>
      <Popover.Dropdown p={0}>
        <RelationPicker
          pageId={property.pageId}
          rowId={rowId}
          property={property}
          preview={relation}
          onClose={onCancel}
          autoFocus
        />
      </Popover.Dropdown>
    </Popover>
  );
}
