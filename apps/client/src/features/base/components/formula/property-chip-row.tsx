import { useState, useMemo } from "react";
import { Group, TextInput, UnstyledButton, Text } from "@mantine/core";
import { IconSearch } from "@tabler/icons-react";
import type { IBaseProperty } from "@/features/base/types/base.types";

export function PropertyChipRow({
  properties,
  onInsert,
}: {
  properties: IBaseProperty[];
  onInsert: (name: string) => void;
}) {
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return properties;
    return properties.filter((p) => p.name.toLowerCase().includes(q));
  }, [properties, query]);

  return (
    <div>
      <Group justify="space-between" mb={8}>
        <Text size="xs" fw={600} c="gray.7">
          Properties
        </Text>
        <TextInput
          size="xs"
          placeholder="Search"
          leftSection={<IconSearch size={12} />}
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          w={140}
        />
      </Group>
      {visible.length === 0 ? (
        <Text size="xs" c="dimmed" py={6}>
          No matches.
        </Text>
      ) : (
        <Group gap={6}>
          {visible.map((p) => (
            <UnstyledButton
              key={p.id}
              onClick={() => onInsert(p.name)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "3px 9px",
                borderRadius: 6,
                fontSize: 12.5,
                fontWeight: 500,
                lineHeight: 1.4,
                background: "var(--mantine-color-blue-0)",
                border: "1px solid var(--mantine-color-blue-2)",
                color: "var(--mantine-color-blue-7)",
                cursor: "pointer",
              }}
            >
              {p.name}
            </UnstyledButton>
          ))}
        </Group>
      )}
    </div>
  );
}
