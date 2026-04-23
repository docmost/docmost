import { Badge, Group } from "@mantine/core";
import type { IBaseProperty } from "@/features/base/types/base.types";

export function PropertyChipRow({
  properties,
  onInsert,
}: {
  properties: IBaseProperty[];
  onInsert: (name: string) => void;
}) {
  return (
    <Group gap={4}>
      {properties.map((p) => (
        <Badge
          key={p.id}
          variant="light"
          style={{ cursor: "pointer" }}
          onClick={() => onInsert(p.name)}
        >
          {p.name}
        </Badge>
      ))}
    </Group>
  );
}
