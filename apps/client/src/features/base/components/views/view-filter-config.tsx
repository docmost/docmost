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

  const operatorOptions = OPERATORS.map((op) => ({
    value: op.value,
    label: t(op.labelKey),
  }));

  const handleAdd = useCallback(() => {
    const firstProperty = properties[0];
    if (!firstProperty) return;
    onChange([
      ...filters,
      { propertyId: firstProperty.id, operator: "contains" },
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
      onChange(
        filters.map((f, i) => (i === index ? { ...f, propertyId } : f)),
      );
    },
    [filters, onChange],
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
                  <TextInput
                    size="xs"
                    placeholder={t("Value")}
                    value={(filter.value as string) ?? ""}
                    onChange={(e) =>
                      handleValueChange(index, e.currentTarget.value)
                    }
                    w={100}
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
