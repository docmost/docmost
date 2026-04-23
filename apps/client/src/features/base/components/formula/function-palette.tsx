import { Accordion, Badge, Group, Tooltip } from "@mantine/core";
import type { FormulaFn } from "@docmost/base-formula/client";

const CATEGORIES = ["logic", "math", "string", "date", "coercion"] as const;

export function FunctionPalette({
  registry,
  onInsert,
}: {
  registry: ReadonlyMap<string, FormulaFn>;
  onInsert: (name: string) => void;
}) {
  const byCat = new Map<string, FormulaFn[]>();
  for (const fn of registry.values()) {
    if (!byCat.has(fn.category)) byCat.set(fn.category, []);
    byCat.get(fn.category)!.push(fn);
  }
  return (
    <Accordion multiple>
      {CATEGORIES.map((cat) => (
        <Accordion.Item key={cat} value={cat}>
          <Accordion.Control>{cat}</Accordion.Control>
          <Accordion.Panel>
            <Group gap={4}>
              {(byCat.get(cat) ?? []).map((fn) => (
                <Tooltip key={fn.name} label={fn.doc}>
                  <Badge
                    variant="outline"
                    style={{ cursor: "pointer" }}
                    onClick={() => onInsert(fn.name)}
                  >
                    {fn.name}
                  </Badge>
                </Tooltip>
              ))}
            </Group>
          </Accordion.Panel>
        </Accordion.Item>
      ))}
    </Accordion>
  );
}
