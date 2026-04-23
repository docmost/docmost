import { useState } from "react";
import { Button, Divider, Group, Paper, Stack, Text } from "@mantine/core";
import { registry } from "@docmost/base-formula/client";
import { FormulaInput } from "./formula-input";
import { PropertyChipRow } from "./property-chip-row";
import { FunctionPalette } from "./function-palette";
import { useFormulaParser } from "@/features/base/hooks/use-formula-parser";
import type { IBaseProperty } from "@/features/base/types/base.types";

type Props = {
  properties: IBaseProperty[];
  editingPropertyId: string | null;
  initialSource?: string;
  onSave: (
    source: string,
    ast: unknown,
    resultType: string,
    dependencies: string[],
  ) => void;
  onCancel: () => void;
};

export function FormulaEditor({
  properties,
  editingPropertyId,
  initialSource = "",
  onSave,
  onCancel,
}: Props) {
  const [source, setSource] = useState(initialSource);
  const parseState = useFormulaParser(
    source,
    properties,
    editingPropertyId,
    registry,
  );
  const canSave = parseState.state === "ok";

  const insertAtEnd = (snippet: string) =>
    setSource((s) => `${s}${s ? " " : ""}${snippet}`);

  return (
    <Paper p="md" withBorder>
      <Stack gap="sm">
        <Text fw={500}>Formula</Text>
        <FormulaInput
          value={source}
          onChange={setSource}
          error={parseState.state === "error" ? parseState : undefined}
          resultType={parseState.state === "ok" ? parseState.resultType : undefined}
        />
        <Divider />
        <Text size="sm" c="dimmed">Properties</Text>
        <PropertyChipRow
          properties={properties.filter((p) => p.id !== editingPropertyId)}
          onInsert={(name) => insertAtEnd(`prop("${name}")`)}
        />
        <Divider />
        <Text size="sm" c="dimmed">Functions</Text>
        <FunctionPalette
          registry={registry}
          onInsert={(name) => insertAtEnd(`${name}()`)}
        />
        <Group justify="flex-end">
          <Button variant="subtle" onClick={onCancel}>Cancel</Button>
          <Button
            disabled={!canSave}
            onClick={() => {
              if (parseState.state !== "ok") return;
              onSave(
                source,
                parseState.ast,
                parseState.resultType,
                parseState.dependencies,
              );
            }}
          >
            Save
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}
