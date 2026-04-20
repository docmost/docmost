import { useCallback, useEffect, useState } from "react";
import {
  Popover,
  Stack,
  Group,
  Select,
  TextInput,
  ActionIcon,
  Text,
  UnstyledButton,
  Button,
} from "@mantine/core";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import {
  IBaseProperty,
  SelectTypeOptions,
  FilterCondition,
  FilterOperator,
} from "@/features/base/types/base.types";
import { useTranslation } from "react-i18next";

/*
 * Operator metadata for the filter popover. Values use the server
 * engine's operator set (`core/base/engine/schema.zod.ts`); labels are
 * i18n-translated display strings.
 */
const OPERATORS: { value: FilterOperator; labelKey: string }[] = [
  { value: "eq", labelKey: "Equals" },
  { value: "neq", labelKey: "Not equals" },
  { value: "contains", labelKey: "Contains" },
  { value: "ncontains", labelKey: "Not contains" },
  { value: "isEmpty", labelKey: "Is empty" },
  { value: "isNotEmpty", labelKey: "Is not empty" },
  { value: "gt", labelKey: "Greater than" },
  { value: "lt", labelKey: "Less than" },
  { value: "before", labelKey: "Before" },
  { value: "after", labelKey: "After" },
  { value: "any", labelKey: "Any of" },
  { value: "none", labelKey: "None of" },
];

const NO_VALUE_OPERATORS: FilterOperator[] = ["isEmpty", "isNotEmpty"];

function getOperatorsForType(type: string): FilterOperator[] {
  switch (type) {
    case "text":
    case "email":
    case "url":
      return ["eq", "neq", "contains", "ncontains", "isEmpty", "isNotEmpty"];
    case "number":
      return ["eq", "neq", "gt", "lt", "isEmpty", "isNotEmpty"];
    case "date":
    case "createdAt":
    case "lastEditedAt":
      return ["eq", "neq", "before", "after", "isEmpty", "isNotEmpty"];
    case "select":
    case "status":
      return ["eq", "neq", "any", "none", "isEmpty", "isNotEmpty"];
    case "multiSelect":
      return ["any", "none", "isEmpty", "isNotEmpty"];
    case "checkbox":
      return ["eq", "isEmpty", "isNotEmpty"];
    case "person":
    case "lastEditedBy":
      return ["eq", "neq", "any", "none", "isEmpty", "isNotEmpty"];
    case "file":
      return ["isEmpty", "isNotEmpty"];
    case "page":
      return ["isEmpty", "isNotEmpty"];
    default:
      return ["eq", "neq", "isEmpty", "isNotEmpty"];
  }
}

function FilterValueInput({
  condition,
  property,
  onChange,
  t,
}: {
  condition: FilterCondition;
  property: IBaseProperty | undefined;
  onChange: (value: string) => void;
  t: (key: string) => string;
}) {
  if (!property) {
    return (
      <TextInput
        size="xs"
        placeholder={t("Value")}
        value={(condition.value as string) ?? ""}
        onChange={(e) => onChange(e.currentTarget.value)}
        w={100}
      />
    );
  }

  const type = property.type;

  if (type === "select" || type === "status" || type === "multiSelect") {
    const typeOptions = property.typeOptions as SelectTypeOptions | undefined;
    const choices = typeOptions?.choices ?? [];
    const choiceOptions = choices.map((c) => ({ value: c.id, label: c.name }));
    return (
      <Select
        size="xs"
        data={choiceOptions}
        value={(condition.value as string) ?? null}
        onChange={(val) => onChange(val ?? "")}
        w={120}
        placeholder={t("Select")}
      />
    );
  }

  if (type === "number") {
    return (
      <TextInput
        size="xs"
        type="number"
        placeholder={t("Value")}
        value={(condition.value as string) ?? ""}
        onChange={(e) => onChange(e.currentTarget.value)}
        w={100}
      />
    );
  }

  if (type === "checkbox") {
    return (
      <Select
        size="xs"
        data={[
          { value: "true", label: t("True") },
          { value: "false", label: t("False") },
        ]}
        value={(condition.value as string) ?? null}
        onChange={(val) => onChange(val ?? "")}
        w={100}
      />
    );
  }

  return (
    <TextInput
      size="xs"
      placeholder={t("Value")}
      value={(condition.value as string) ?? ""}
      onChange={(e) => onChange(e.currentTarget.value)}
      w={100}
    />
  );
}

type ViewFilterConfigProps = {
  opened: boolean;
  onClose: () => void;
  conditions: FilterCondition[];
  properties: IBaseProperty[];
  onChange: (conditions: FilterCondition[]) => void;
  children: React.ReactNode;
};

export function ViewFilterConfigPopover({
  opened,
  onClose,
  conditions,
  properties,
  onChange,
  children,
}: ViewFilterConfigProps) {
  const { t } = useTranslation();

  const propertyOptions = properties.map((p) => ({
    value: p.id,
    label: p.name,
  }));

  const [draft, setDraft] = useState<FilterCondition | null>(null);

  useEffect(() => {
    if (!opened) setDraft(null);
  }, [opened]);

  const handleStartDraft = useCallback(() => {
    const firstProperty = properties[0];
    if (!firstProperty) return;
    const validOperators = getOperatorsForType(firstProperty.type);
    const defaultOperator = validOperators.includes("contains")
      ? ("contains" as FilterOperator)
      : validOperators[0];
    setDraft({ propertyId: firstProperty.id, op: defaultOperator });
  }, [properties]);

  const handleSaveDraft = useCallback(() => {
    if (!draft) return;
    onChange([...conditions, draft]);
    setDraft(null);
  }, [draft, conditions, onChange]);

  const handleCancelDraft = useCallback(() => {
    setDraft(null);
  }, []);

  const handleDraftPropertyChange = useCallback(
    (propertyId: string | null) => {
      if (!propertyId || !draft) return;
      const newProperty = properties.find((p) => p.id === propertyId);
      if (!newProperty) {
        setDraft({ ...draft, propertyId });
        return;
      }
      const validOperators = getOperatorsForType(newProperty.type);
      const currentOperatorValid = validOperators.includes(draft.op);
      setDraft({
        ...draft,
        propertyId,
        op: currentOperatorValid ? draft.op : validOperators[0],
        value: currentOperatorValid ? draft.value : undefined,
      });
    },
    [draft, properties],
  );

  const handleDraftOperatorChange = useCallback(
    (operator: string | null) => {
      if (!operator || !draft) return;
      const op = operator as FilterOperator;
      const needsValue = !NO_VALUE_OPERATORS.includes(op);
      setDraft({ ...draft, op, value: needsValue ? draft.value : undefined });
    },
    [draft],
  );

  const handleDraftValueChange = useCallback(
    (value: string) => {
      if (!draft) return;
      setDraft({ ...draft, value: value || undefined });
    },
    [draft],
  );

  const handleRemove = useCallback(
    (index: number) => {
      onChange(conditions.filter((_, i) => i !== index));
    },
    [conditions, onChange],
  );

  const handlePropertyChange = useCallback(
    (index: number, propertyId: string | null) => {
      if (!propertyId) return;
      const newProperty = properties.find((p) => p.id === propertyId);
      onChange(
        conditions.map((f, i) => {
          if (i !== index) return f;
          if (newProperty) {
            const validOperators = getOperatorsForType(newProperty.type);
            const currentOperatorValid = validOperators.includes(f.op);
            return {
              ...f,
              propertyId,
              op: currentOperatorValid ? f.op : validOperators[0],
              value: currentOperatorValid ? f.value : undefined,
            };
          }
          return { ...f, propertyId };
        }),
      );
    },
    [conditions, properties, onChange],
  );

  const handleOperatorChange = useCallback(
    (index: number, operator: string | null) => {
      if (!operator) return;
      const op = operator as FilterOperator;
      const needsValue = !NO_VALUE_OPERATORS.includes(op);
      onChange(
        conditions.map((f, i) =>
          i === index
            ? {
                ...f,
                op,
                value: needsValue ? f.value : undefined,
              }
            : f,
        ),
      );
    },
    [conditions, onChange],
  );

  const handleValueChange = useCallback(
    (index: number, value: string) => {
      onChange(
        conditions.map((f, i) =>
          i === index ? { ...f, value: value || undefined } : f,
        ),
      );
    },
    [conditions, onChange],
  );

  return (
    <Popover
      opened={opened}
      onClose={onClose}
      position="bottom-end"
      shadow="md"
      width={440}
      trapFocus
      withinPortal
    >
      <Popover.Target>{children}</Popover.Target>
      <Popover.Dropdown>
        <Stack gap="xs">
          <Text size="xs" fw={600} c="dimmed">
            {t("Filter by")}
          </Text>

          {conditions.length === 0 && !draft && (
            <Text size="xs" c="dimmed">
              {t("No filters applied")}
            </Text>
          )}

          {conditions.map((condition, index) => {
            const needsValue = !NO_VALUE_OPERATORS.includes(condition.op);
            const property = properties.find(
              (p) => p.id === condition.propertyId,
            );
            const validOperators = property
              ? getOperatorsForType(property.type)
              : OPERATORS.map((op) => op.value);
            const operatorOptions = OPERATORS.filter((op) =>
              validOperators.includes(op.value),
            ).map((op) => ({
              value: op.value,
              label: t(op.labelKey),
            }));

            return (
              <Group key={index} gap="xs" wrap="nowrap">
                <Select
                  size="xs"
                  data={propertyOptions}
                  value={condition.propertyId}
                  onChange={(val) => handlePropertyChange(index, val)}
                  style={{ flex: 1 }}
                />
                <Select
                  size="xs"
                  data={operatorOptions}
                  value={condition.op}
                  onChange={(val) => handleOperatorChange(index, val)}
                  w={130}
                />
                {needsValue && (
                  <FilterValueInput
                    condition={condition}
                    property={property}
                    onChange={(val) => handleValueChange(index, val)}
                    t={t}
                  />
                )}
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  size="sm"
                  onClick={() => handleRemove(index)}
                >
                  <IconTrash size={14} />
                </ActionIcon>
              </Group>
            );
          })}

          {draft && (() => {
            const needsValue = !NO_VALUE_OPERATORS.includes(draft.op);
            const property = properties.find((p) => p.id === draft.propertyId);
            const validOperators = property
              ? getOperatorsForType(property.type)
              : OPERATORS.map((op) => op.value);
            const operatorOptions = OPERATORS.filter((op) =>
              validOperators.includes(op.value),
            ).map((op) => ({ value: op.value, label: t(op.labelKey) }));

            return (
              <Stack gap={6}>
                <Group gap="xs" wrap="nowrap">
                  <Select
                    size="xs"
                    data={propertyOptions}
                    value={draft.propertyId}
                    onChange={handleDraftPropertyChange}
                    style={{ flex: 1 }}
                  />
                  <Select
                    size="xs"
                    data={operatorOptions}
                    value={draft.op}
                    onChange={handleDraftOperatorChange}
                    w={130}
                  />
                  {needsValue && (
                    <FilterValueInput
                      condition={draft}
                      property={property}
                      onChange={handleDraftValueChange}
                      t={t}
                    />
                  )}
                </Group>
                <Group justify="flex-end" gap="xs">
                  <Button variant="default" size="xs" onClick={handleCancelDraft}>
                    {t("Cancel")}
                  </Button>
                  <Button size="xs" onClick={handleSaveDraft}>
                    {t("Save")}
                  </Button>
                </Group>
              </Stack>
            );
          })()}

          {!draft && (
            <UnstyledButton
              onClick={handleStartDraft}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 0",
                fontSize: "var(--mantine-font-size-xs)",
                color: "var(--mantine-color-blue-6)",
              }}
            >
              <IconPlus size={14} />
              {t("Add filter")}
            </UnstyledButton>
          )}
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}
