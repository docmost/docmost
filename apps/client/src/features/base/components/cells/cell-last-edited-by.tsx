import { useMemo } from "react";
import { Group } from "@mantine/core";
import { IBaseProperty } from "@/features/base/types/base.types";
import { useWorkspaceMembersQuery } from "@/features/workspace/queries/workspace-query";
import { CustomAvatar } from "@/components/ui/custom-avatar";
import cellClasses from "@/features/base/styles/cells.module.css";

type CellLastEditedByProps = {
  value: unknown;
  property: IBaseProperty;
  rowId: string;
  isEditing: boolean;
  onCommit: (value: unknown) => void;
  onCancel: () => void;
};

export function CellLastEditedBy({ value }: CellLastEditedByProps) {
  const userId = typeof value === "string" ? value : null;

  const { data: membersData } = useWorkspaceMembersQuery({ limit: 100 });

  const user = useMemo(() => {
    if (!userId || !membersData?.items) return null;
    return membersData.items.find((u) => u.id === userId) ?? null;
  }, [userId, membersData?.items]);

  if (!userId) {
    return <span className={cellClasses.emptyValue} />;
  }

  return (
    <Group gap={6} wrap="nowrap" style={{ overflow: "hidden" }}>
      <CustomAvatar
        avatarUrl={user?.avatarUrl ?? ""}
        name={user?.name ?? ""}
        size={20}
        radius="xl"
      />
      {user?.name && (
        <span
          style={{
            fontSize: "var(--mantine-font-size-sm)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {user.name}
        </span>
      )}
    </Group>
  );
}
