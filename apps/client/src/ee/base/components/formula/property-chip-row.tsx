import { useState, useMemo } from "react";
import { Group, TextInput, UnstyledButton, Text } from "@mantine/core";
import { IconSearch } from "@tabler/icons-react";
import type { IBaseProperty } from "@/ee/base/types/base.types";
import classes from "@/ee/base/styles/formula.module.css";

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
              className={classes.propChip}
            >
              {p.name}
            </UnstyledButton>
          ))}
        </Group>
      )}
    </div>
  );
}
