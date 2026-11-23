import {
  ActionIcon,
  Button,
  Flex,
  NumberInput,
  Select,
  Stack,
  TextInput,
} from "@mantine/core";
import { IconPlus, IconX } from "@tabler/icons-react";
import { randomId } from "@mantine/hooks";
import { useTranslation } from "react-i18next";
import type { PageProperty, PagePropertyType } from "../page-property.types";
import type { SelectTypeOptions } from "@/ee/base/types/base.types";

const operators = {
  eq: "Is",
  contains: "Contains",
  gt: "Greater than",
  lt: "Less than",
  empty: "Is empty",
  notEmpty: "Is not empty",
} as const;
type Operator = keyof typeof operators;
export type ReportFilter = {
  id: string;
  fieldId: string;
  operator: Operator;
  value: string | number | boolean;
};

function availableOperators(type: PagePropertyType): Operator[] {
  const empty: Operator[] = ["empty", "notEmpty"];
  switch (type) {
    case "number":
    case "date":
      return ["eq", "gt", "lt", ...empty];
    case "multiSelect":
      return ["contains", ...empty];
    case "select":
    case "status":
    case "checkbox":
      return ["eq", ...empty];
    default:
      return ["contains", "eq", ...empty];
  }
}

function initialFilter(property: PageProperty, id: string): ReportFilter {
  return {
    id,
    fieldId: property.id,
    operator: availableOperators(property.type)[0],
    value: property.type === "checkbox" ? true : "",
  };
}

export function needsValue(filter: ReportFilter) {
  return filter.operator !== "empty" && filter.operator !== "notEmpty";
}

export function ReportFilters({
  fields,
  filters,
  onChange,
}: {
  fields: PageProperty[];
  filters: ReportFilter[];
  onChange: (filters: ReportFilter[]) => void;
}) {
  const { t } = useTranslation();
  const change = (id: string, patch: Partial<ReportFilter>) =>
    onChange(
      filters.map((filter) =>
        filter.id === id ? { ...filter, ...patch } : filter,
      ),
    );
  return (
    <Stack gap="xs">
      {filters.map((filter) => {
        const field = fields.find((property) => property.id === filter.fieldId);
        if (!field) return null;
        const valueProps = {
          size: "xs",
          "aria-label": t("Filter value"),
          style: { flex: "1 1 9rem" },
        };
        const choice = ["multiSelect", "select", "status"].includes(field.type);
        return (
          <Flex key={filter.id} gap="xs" align="center" wrap="wrap">
            <Select
              size="xs"
              aria-label={t("Filter property")}
              allowDeselect={false}
              style={{ flex: "1 1 10rem" }}
              value={filter.fieldId}
              data={fields.map((p) => ({ value: p.id, label: p.name }))}
              onChange={(id) => {
                const next = fields.find((p) => p.id === id);
                if (next) change(filter.id, initialFilter(next, filter.id));
              }}
            />
            <Select
              size="xs"
              aria-label={t("Filter operator")}
              allowDeselect={false}
              style={{ flex: "1 1 8rem" }}
              value={filter.operator}
              data={availableOperators(field.type).map((op) => ({
                value: op,
                label: t(
                  field.type === "date" && op === "gt"
                    ? "After"
                    : field.type === "date" && op === "lt"
                      ? "Before"
                      : operators[op],
                ),
              }))}
              onChange={(op) =>
                op && change(filter.id, { operator: op as Operator })
              }
            />
            {needsValue(filter) &&
              (choice ? (
                <TextInput
                  {...valueProps}
                  list={`report-choice-${filter.id}`}
                  value={String(filter.value)}
                  onChange={(e) =>
                    change(filter.id, { value: e.currentTarget.value })
                  }
                />
              ) : field.type === "checkbox" ? (
                <Select
                  {...valueProps}
                  value={String(filter.value)}
                  allowDeselect={false}
                  data={[
                    { value: "true", label: t("Yes") },
                    { value: "false", label: t("No") },
                  ]}
                  onChange={(v) => change(filter.id, { value: v === "true" })}
                />
              ) : field.type === "number" ? (
                <NumberInput
                  {...valueProps}
                  value={typeof filter.value === "boolean" ? "" : filter.value}
                  onChange={(value) => change(filter.id, { value })}
                />
              ) : (
                <TextInput
                  {...valueProps}
                  type={field.type === "date" ? "date" : "text"}
                  value={String(filter.value)}
                  onChange={(e) =>
                    change(filter.id, { value: e.currentTarget.value })
                  }
                />
              ))}
            {choice && (
              <datalist id={`report-choice-${filter.id}`}>
                {((field.typeOptions as SelectTypeOptions).choices ?? []).map(
                  (c) => (
                    <option key={c.id} value={c.name} />
                  ),
                )}
              </datalist>
            )}
            <ActionIcon
              size="sm"
              variant="subtle"
              color="gray"
              aria-label={t("Remove filter")}
              onClick={() =>
                onChange(filters.filter((item) => item.id !== filter.id))
              }
            >
              <IconX size={15} />
            </ActionIcon>
          </Flex>
        );
      })}
      <Button
        variant="subtle"
        size="compact-xs"
        style={{ alignSelf: "flex-start" }}
        leftSection={<IconPlus size={14} />}
        disabled={fields.length === 0 || filters.length >= 12}
        onClick={() =>
          onChange([...filters, initialFilter(fields[0], randomId())])
        }
      >
        {t("Add filter")}
      </Button>
    </Stack>
  );
}
