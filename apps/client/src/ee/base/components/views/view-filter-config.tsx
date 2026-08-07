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
} from "@/ee/base/types/base.types";
import { useTranslation } from "react-i18next";
import {
  getDescriptor,
  DEFAULT_FILTER_OPERATORS,
} from "@/ee/base/property-types/property-type.registry";
import { FilterPersonInput } from "./filter-person-input";
import { FilterDateInput } from "./filter-date-input";
import { useEscapeClose } from "@/ee/base/hooks/use-escape-close";
import viewClasses from "@/ee/base/styles/views.module.css";

const OPERATORS: { value: FilterOperator; labelKey: string }[] = [
  { value: "eq", labelKey: "Is" },
  { value: "neq", labelKey: "Is not" },
  { value: "contains", labelKey: "Contains" },
  { value: "ncontains", labelKey: "Doesn't contain" },
  { value: "any", labelKey: "Is any of" },
  { value: "none", labelKey: "Is none of" },
  { value: "before", labelKey: "Is before" },
  { value: "after", labelKey: "Is after" },
  { value: "onOrBefore", labelKey: "Is on or before" },
  { value: "onOrAfter", labelKey: "Is on or after" },
  { value: "isWithin", labelKey: "Is within" },
  { value: "gt", labelKey: "Greater than" },
  { value: "lt", labelKey: "Less than" },
  { value: "isEmpty", labelKey: "Is empty" },
  { value: "isNotEmpty", labelKey: "Is not empty" },
];

const NO_VALUE_OPERATORS: FilterOperator[] = ["isEmpty", "isNotEmpty"];

// Two operators share a value control only if they share a value class.
// Switching across classes (e.g. eq→any, exact-date→isWithin) must reset the
// stored value so a stale shape isn't sent to the engine.
function valueClass(op: FilterOperator, inputKind: string): string {
  if (NO_VALUE_OPERATORS.includes(op)) return "none";
  if (inputKind === "person") {
    return op === "any" || op === "none" ? "personMulti" : "personSingle";
  }
  if (inputKind === "date") {
    return op === "isWithin" ? "dateRange" : "dateInstant";
  }
  return "scalar";
}

function inputKindForProperty(property: IBaseProperty | undefined): string {
  return getDescriptor(property?.type ?? "")?.filterInput ?? "text";
}

function getOperatorsForType(type: string): FilterOperator[] {
  return (getDescriptor(type)?.filterOperators ??
    DEFAULT_FILTER_OPERATORS) as FilterOperator[];
}

function FilterValueInput({
  condition,
  property,
  onChange,
  t,
}: {
  condition: FilterCondition;
  property: IBaseProperty | undefined;
  onChange: (value: unknown) => void;
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

  const kind = getDescriptor(property.type)?.filterInput ?? "text";

  if (kind === "person") {
    return (
      <FilterPersonInput
        pageId={property.pageId}
        multiple={condition.op === "any" || condition.op === "none"}
        value={condition.value}
        onChange={onChange}
        placeholder={t("Select")}
      />
    );
  }

  if (kind === "date") {
    return (
      <FilterDateInput
        op={condition.op}
        value={condition.value}
        onChange={onChange}
      />
    );
  }

  if (kind === "choices") {
    const typeOptions = property.typeOptions as SelectTypeOptions | undefined;
    const choices = typeOptions?.choices ?? [];
    const choiceOptions = choices.map((c) => ({ value: c.id, label: c.name }));
    return (
      <Select
        size="xs"
        comboboxProps={{ withinPortal: false }}
        data={choiceOptions}
        value={(condition.value as string) ?? null}
        onChange={(val) => onChange(val ?? "")}
        w={120}
        placeholder={t("Select")}
      />
    );
  }

  if (kind === "number") {
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

  if (kind === "boolean") {
    return (
      <Select
        size="xs"
        comboboxProps={{ withinPortal: false }}
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
  useEscapeClose(opened, onClose);

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
      const sameKind =
        inputKindForProperty(
          properties.find((p) => p.id === draft.propertyId),
        ) === inputKindForProperty(newProperty);
      setDraft({
        ...draft,
        propertyId,
        op: currentOperatorValid ? draft.op : validOperators[0],
        value: currentOperatorValid && sameKind ? draft.value : undefined,
      });
    },
    [draft, properties],
  );

  const handleDraftOperatorChange = useCallback(
    (operator: string | null) => {
      if (!operator || !draft) return;
      const op = operator as FilterOperator;
      const kind = inputKindForProperty(
        properties.find((p) => p.id === draft.propertyId),
      );
      const keep = valueClass(draft.op, kind) === valueClass(op, kind);
      setDraft({ ...draft, op, value: keep ? draft.value : undefined });
    },
    [draft, properties],
  );

  const handleDraftValueChange = useCallback(
    (value: unknown) => {
      if (!draft) return;
      setDraft({ ...draft, value });
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
            const sameKind =
              inputKindForProperty(
                properties.find((p) => p.id === f.propertyId),
              ) === inputKindForProperty(newProperty);
            return {
              ...f,
              propertyId,
              op: currentOperatorValid ? f.op : validOperators[0],
              value: currentOperatorValid && sameKind ? f.value : undefined,
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
      onChange(
        conditions.map((f, i) => {
          if (i !== index) return f;
          const kind = inputKindForProperty(
            properties.find((p) => p.id === f.propertyId),
          );
          const keep = valueClass(f.op, kind) === valueClass(op, kind);
          return { ...f, op, value: keep ? f.value : undefined };
        }),
      );
    },
    [conditions, properties, onChange],
  );

  const handleValueChange = useCallback(
    (index: number, value: unknown) => {
      onChange(
        conditions.map((f, i) => (i === index ? { ...f, value } : f)),
      );
    },
    [conditions, onChange],
  );

  return (
    <Popover
      opened={opened}
      onChange={(o) => {
        if (!o) onClose();
      }}
      onClose={onClose}
      position="bottom-end"
      shadow="md"
      width={520}
      trapFocus
      closeOnEscape={false}
      closeOnClickOutside
      withinPortal
    >
      <Popover.Target>{children}</Popover.Target>
      <Popover.Dropdown
        onKeyDown={(e) => {
          // Mantine's built-in closeOnEscape uses a capture-phase handler that
          // would fire before a nested picker can consume Escape, closing the
          // whole panel. Handle it on bubble instead so an open inner picker
          // (which preventDefaults Escape) keeps the panel open.
          if (e.key === "Escape" && !e.defaultPrevented) onClose();
        }}
      >
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
                  comboboxProps={{ withinPortal: false }}
                  data={propertyOptions}
                  searchable
                  openOnFocus={false}
                  nothingFoundMessage={t("No match")}
                  value={condition.propertyId}
                  onChange={(val) => handlePropertyChange(index, val)}
                  style={{ flex: 1 }}
                />
                <Select
                  size="xs"
                  comboboxProps={{ withinPortal: false }}
                  data={operatorOptions}
                  searchable
                  openOnFocus={false}
                  nothingFoundMessage={t("No match")}
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
                    comboboxProps={{ withinPortal: false }}
                    data={propertyOptions}
                    searchable
                    openOnFocus={false}
                    nothingFoundMessage={t("No match")}
                    value={draft.propertyId}
                    onChange={handleDraftPropertyChange}
                    style={{ flex: 1 }}
                  />
                  <Select
                    size="xs"
                    comboboxProps={{ withinPortal: false }}
                    data={operatorOptions}
                    searchable
                    openOnFocus={false}
                    nothingFoundMessage={t("No match")}
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
              className={viewClasses.addActionButton}
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
