import { Group, Tooltip } from "@mantine/core";
import { IBaseProperty } from "@/ee/base/types/base.types";
import { useReferenceStore } from "@/ee/base/reference/reference-store";
import { CustomAvatar } from "@/components/ui/custom-avatar";
import cellClasses from "@/ee/base/styles/cells.module.css";

type CellLastEditedByProps = {
  value: unknown;
  property: IBaseProperty;
  rowId: string;
  isEditing: boolean;
  onCommit: (value: unknown) => void;
  onCancel: () => void;
};

export function CellLastEditedBy({ value, property }: CellLastEditedByProps) {
  const userId = typeof value === "string" ? value : null;

  const store = useReferenceStore(property.pageId);
  const user = userId ? store.users[userId] ?? null : null;

  if (!userId) {
    return <span className={cellClasses.emptyValue} />;
  }

  const name = user?.name ?? userId.substring(0, 8);

  return (
    <Group gap={6} wrap="nowrap" style={{ overflow: "hidden" }}>
      <CustomAvatar
        avatarUrl={user?.avatarUrl ?? ""}
        name={name}
        size={20}
        radius="xl"
      />
      <Tooltip label={name} withinPortal openDelay={400} disabled={!name}>
        <span className={cellClasses.lastEditedByName}>{name}</span>
      </Tooltip>
    </Group>
  );
}
