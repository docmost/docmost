import { useState } from "react";
import {
  Accordion,
  Group,
  Text,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import type { FormulaFn } from "@docmost/base-formula/client";
import classes from "@/ee/base/styles/formula.module.css";

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
      chevronSize={14}
      styles={{
        item: { borderColor: "var(--mantine-color-gray-2)" },
        control: { padding: "7px 12px", minHeight: 0 },
        label: {
          padding: 0,
          fontSize: 13,
          fontWeight: 600,
          textTransform: "capitalize",
        },
        content: { padding: "6px 10px 10px" },
        panel: { background: "var(--mantine-color-gray-0)" },
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
                      className={classes.fnChip}
                    >
                      {fn.name}
                      <span className={classes.fnChipParens}>
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
