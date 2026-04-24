import { useState } from "react";
import {
  Accordion,
  Group,
  Text,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import type { FormulaFn } from "@docmost/base-formula/client";

const CATEGORIES = ["logic", "math", "string", "date", "coercion"] as const;

export function FunctionPalette({
  registry,
  onInsert,
}: {
  registry: ReadonlyMap<string, FormulaFn>;
  onInsert: (name: string) => void;
}) {
  const [open, setOpen] = useState<string | null>("logic");

  const byCat = new Map<string, FormulaFn[]>();
  for (const fn of registry.values()) {
    if (!byCat.has(fn.category)) byCat.set(fn.category, []);
    byCat.get(fn.category)!.push(fn);
  }

  return (
    <Accordion
      value={open}
      onChange={setOpen}
      variant="contained"
      radius="md"
      styles={{
        item: { borderColor: "var(--mantine-color-gray-3)" },
        control: { padding: "9px 12px" },
        label: { fontSize: 13, fontWeight: 500, textTransform: "capitalize" },
        content: { padding: "8px 10px 12px" },
      }}
    >
      {CATEGORIES.map((cat) => {
        const fns = byCat.get(cat) ?? [];
        return (
          <Accordion.Item key={cat} value={cat}>
            <Accordion.Control>
              <Group gap={8}>
                <span>{cat}</span>
                <Text size="xs" c="dimmed" ff="monospace">
                  {fns.length}
                </Text>
              </Group>
            </Accordion.Control>
            <Accordion.Panel>
              <Group gap={6}>
                {fns.map((fn) => (
                  <Tooltip key={fn.name} label={fn.doc} withArrow>
                    <UnstyledButton
                      onClick={() => onInsert(fn.name)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 3,
                        padding: "3px 9px",
                        borderRadius: 5,
                        fontFamily:
                          "ui-monospace, SFMono-Regular, Menlo, 'JetBrains Mono', monospace",
                        fontSize: 12.5,
                        color: "var(--mantine-color-blue-7)",
                        background: "var(--mantine-color-white)",
                        border: "1px solid var(--mantine-color-gray-3)",
                        cursor: "pointer",
                      }}
                    >
                      {fn.name}
                      <span style={{ color: "var(--mantine-color-gray-5)" }}>
                        ()
                      </span>
                    </UnstyledButton>
                  </Tooltip>
                ))}
              </Group>
            </Accordion.Panel>
          </Accordion.Item>
        );
      })}
    </Accordion>
  );
}
