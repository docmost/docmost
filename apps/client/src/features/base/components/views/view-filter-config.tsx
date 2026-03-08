import { useCallback } from "react";
import {
  Popover,
  Stack,
  Group,
  Select,
  TextInput,
  ActionIcon,
  Text,
  UnstyledButton,
} from "@mantine/core";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import {
  IBaseProperty,
  SelectTypeOptions,
  ViewFilterConfig,
  ViewFilterOperator,
} from "@/features/base/types/base.types";
import { useTranslation } from "react-i18next";

const OPERATORS: { value: ViewFilterOperator; labelKey: string }[] = [
  { value: "equals", labelKey: "Equals" },
  { value: "notEquals", labelKey: "Not equals" },
  { value: "contains", labelKey: "Contains" },
  { value: "notContains", labelKey: "Not contains" },
  { value: "isEmpty", labelKey: "Is empty" },
  { value: "isNotEmpty", labelKey: "Is not empty" },
  { value: "greaterThan", labelKey: "Greater than" },
  { value: "lessThan", labelKey: "Less than" },
  { value: "before", labelKey: "Before" },
  { value: "after", labelKey: "After" },
];

const NO_VALUE_OPERATORS: ViewFilterOperator[] = ["isEmpty", "isNotEmpty"];

function getOperatorsForType(type: string): ViewFilterOperator[] {
  switch (type) {
    case "text":
    case "email":
    case "url":
      return ["equals", "notEquals", "contains", "notContains", "isEmpty", "isNotEmpty"];
    case "number":
      return ["equals", "notEquals", "greaterThan", "lessThan", "isEmpty", "isNotEmpty"];
    case "date":
    case "createdAt":
    case "lastEditedAt":
      return ["equals", "notEquals", "before", "after", "isEmpty", "isNotEmpty"];
    case "select":
    case "status":
    case "multiSelect":
      return ["equals", "notEquals", "isEmpty", "isNotEmpty"];
    case "checkbox":
      return ["equals", "isEmpty", "isNotEmpty"];
    case "person":
    case "lastEditedBy":
      return ["equals", "notEquals", "isEmpty", "isNotEmpty"];
    case "file":
      return ["isEmpty", "isNotEmpty"];
    default:
      return ["equals", "notEquals", "isEmpty", "isNotEmpty"];
  }
}

function FilterValueInput({
  filter,
  property,
  onChange,
  t,
}: {
  filter: ViewFilterConfig;
  property: IBaseProperty | undefined;
  onChange: (value: string) => void;
  t: (key: string) => string;
}) {
  if (!property) {
    return (
      <TextInput
        size="xs"
        placeholder={t("Value")}
        value={(filter.value as string) ?? ""}
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
        value={(filter.value as string) ?? null}
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
        value={(filter.value as string) ?? ""}
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
        value={(filter.value as string) ?? null}
        onChange={(val) => onChange(val ?? "")}
        w={100}
      />
    );
  }

  return (
    <TextInput
      size="xs"
      placeholder={t("Value")}
      value={(filter.value as string) ?? ""}
      onChange={(e) => onChange(e.currentTarget.value)}
      w={100}
    />
  );
}

type ViewFilterConfigProps = {
  opened: boolean;
  onClose: () => void;
  filters: ViewFilterConfig[];
  properties: IBaseProperty[];
  onChange: (filters: ViewFilterConfig[]) => void;
  children: React.ReactNode;
};

export function ViewFilterConfigPopover({
  opened,
  onClose,
  filters,
  properties,
  onChange,
  children,
}: ViewFilterConfigProps) {
  const { t } = useTranslation();

  const propertyOptions = properties.map((p) => ({
    value: p.id,
    label: p.name,
  }));

  const handleAdd = useCallback(() => {
    const firstProperty = properties[0];
    if (!firstProperty) return;
    const validOperators = getOperatorsForType(firstProperty.type);
    const defaultOperator = validOperators.includes("contains") ? "contains" : validOperators[0];
    onChange([
      ...filters,
      { propertyId: firstProperty.id, operator: defaultOperator },
    ]);
  }, [filters, properties, onChange]);

  const handleRemove = useCallback(
    (index: number) => {
      onChange(filters.filter((_, i) => i !== index));
    },
    [filters, onChange],
  );

  const handlePropertyChange = useCallback(
    (index: number, propertyId: string | null) => {
      if (!propertyId) return;
      const newProperty = properties.find((p) => p.id === propertyId);
      onChange(
        filters.map((f, i) => {
          if (i !== index) return f;
          if (newProperty) {
            const validOperators = getOperatorsForType(newProperty.type);
            const currentOperatorValid = validOperators.includes(f.operator);
            return {
              ...f,
              propertyId,
              operator: currentOperatorValid ? f.operator : validOperators[0],
              value: currentOperatorValid ? f.value : undefined,
            };
          }
          return { ...f, propertyId };
        }),
      );
    },
    [filters, properties, onChange],
  );

  const handleOperatorChange = useCallback(
    (index: number, operator: string | null) => {
      if (!operator) return;
      const op = operator as ViewFilterOperator;
      const needsValue = !NO_VALUE_OPERATORS.includes(op);
      onChange(
        filters.map((f, i) =>
          i === index
            ? {
                ...f,
                operator: op,
                value: needsValue ? f.value : undefined,
              }
            : f,
        ),
      );
    },
    [filters, onChange],
  );

  const handleValueChange = useCallback(
    (index: number, value: string) => {
      onChange(
        filters.map((f, i) =>
          i === index ? { ...f, value: value || undefined } : f,
        ),
      );
    },
    [filters, onChange],
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

          {filters.length === 0 && (
            <Text size="xs" c="dimmed">
              {t("No filters applied")}
            </Text>
          )}

          {filters.map((filter, index) => {
            const needsValue = !NO_VALUE_OPERATORS.includes(filter.operator);
            const property = properties.find((p) => p.id === filter.propertyId);
            const validOperators = property
              ? getOperatorsForType(property.type)
              : OPERATORS.map((op) => op.value);
            const operatorOptions = OPERATORS
              .filter((op) => validOperators.includes(op.value))
              .map((op) => ({
                value: op.value,
                label: t(op.labelKey),
              }));

            return (
              <Group key={index} gap="xs" wrap="nowrap">
                <Select
                  size="xs"
                  data={propertyOptions}
                  value={filter.propertyId}
                  onChange={(val) => handlePropertyChange(index, val)}
                  style={{ flex: 1 }}
                />
                <Select
                  size="xs"
                  data={operatorOptions}
                  value={filter.operator}
                  onChange={(val) => handleOperatorChange(index, val)}
                  w={130}
                />
                {needsValue && (
                  <FilterValueInput
                    filter={filter}
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

          <UnstyledButton
            onClick={handleAdd}
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
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}
