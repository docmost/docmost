import { useState } from "react";
import {
  Button,
  Divider,
  Group,
  Kbd,
  Paper,
  Stack,
  Text,
} from "@mantine/core";
import {
  IconAlertTriangle,
  IconMathFunction,
  IconPointFilled,
} from "@tabler/icons-react";
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
  name?: string;
  disabled?: boolean;
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
  name,
  disabled = false,
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
  const canSave = parseState.state === "ok" && !disabled;
  const insertAtEnd = (snippet: string) =>
    setSource((s) => `${s}${s ? " " : ""}${snippet}`);

  return (
    <Paper
      withBorder
      radius="md"
      shadow="sm"
      p={0}
      style={{ overflow: "hidden" }}
    >
      <Stack gap={0}>
        <Group
          gap={10}
          px="md"
          py={12}
          style={{
            borderBottom: "1px solid var(--mantine-color-gray-2)",
          }}
        >
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: 5,
              display: "grid",
              placeItems: "center",
              background: "var(--mantine-color-blue-0)",
              color: "var(--mantine-color-blue-6)",
            }}
          >
            <IconMathFunction size={14} />
          </div>
          <Text size="sm" fw={600}>
            Formula
          </Text>
          {name && (
            <Text size="sm" c="dimmed">
              · {name}
            </Text>
          )}
        </Group>

        <Stack gap={6} px={14} pt={10} pb={8}>
          <FormulaInput
            value={source}
            onChange={setSource}
            hasError={parseState.state === "error"}
          />
          <Group justify="space-between" gap={8} mih={16}>
            {parseState.state === "error" ? (
              <Group gap={6} c="red.7">
                <IconAlertTriangle size={12} />
                <Text size="xs">{parseState.message}</Text>
              </Group>
            ) : parseState.state === "ok" ? (
              <Group gap={6} c="dimmed">
                <IconPointFilled size={10} color="var(--mantine-color-teal-6)" />
                <Text size="xs">
                  Returns{" "}
                  <Text span fw={600} c="gray.8">
                    {parseState.resultType}
                  </Text>
                </Text>
              </Group>
            ) : (
              <Text size="xs" c="dimmed">
                Click a property or function below to insert.
              </Text>
            )}
          </Group>
        </Stack>

        <Divider />

        <Stack gap={8} px={14} pt={10} pb={10}>
          <PropertyChipRow
            properties={properties.filter((p) => p.id !== editingPropertyId)}
            onInsert={(name) => insertAtEnd(`prop("${name}")`)}
          />
        </Stack>

        <Divider />

        <Stack gap={6} px={14} pt={10} pb={10}>
          <Text size="xs" fw={600} c="gray.7">
            Functions
          </Text>
          <FunctionPalette
            registry={registry}
            onInsert={(name) => insertAtEnd(`${name}()`)}
          />
        </Stack>

        <Group
          justify="space-between"
          px="md"
          py={10}
          style={{
            borderTop: "1px solid var(--mantine-color-gray-2)",
            background: "var(--mantine-color-gray-0)",
          }}
        >
          <Group gap={6}>
            <Kbd>⌘</Kbd>
            <Kbd>↵</Kbd>
            <Text size="xs" c="dimmed">
              to save
            </Text>
          </Group>
          <Group gap={8}>
            <Button variant="subtle" size="xs" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              size="xs"
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
        </Group>
      </Stack>
    </Paper>
  );
}
