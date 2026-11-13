import { useEffect, useRef, useState } from "react";
import {
  ActionIcon,
  CheckIcon,
  Combobox,
  Group,
  InputBase,
  ScrollArea,
  Text,
  TextInput,
  useCombobox,
} from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { PROPERTY_TYPE_REGISTRY } from "@/ee/base/property-types/property-type.registry";
import { IBaseProperty } from "@/ee/base/types/base.types";
import { MAX_PROPERTY_NAME_LENGTH } from "@/ee/base/csv-import/csv-import.constants";
import type {
  CsvColumnPlan,
  CsvImportPropertyType,
} from "@/ee/base/csv-import/csv-import.types";
import classes from "@/ee/base/styles/csv-import.module.css";

const NEW_PROPERTY = "__new";

export function TypeIcon({ type, size = 14 }: { type: CsvImportPropertyType; size?: number }) {
  const Icon = PROPERTY_TYPE_REGISTRY[type].icon;
  return <Icon size={size} />;
}

type CsvImportTargetProps = {
  plan: CsvColumnPlan;
  columnLabel: string;
  importable: IBaseProperty[];
  propertiesById: Map<string, IBaseProperty>;
  usedElsewhere: Set<string>;
  nameTaken: boolean;
  disabled: boolean;
  onSelectNew: () => void;
  onSelectExisting: (propertyId: string) => void;
  onRename: (name: string) => void;
};

// a new property's name is typed into the field; the chevron picks an existing property instead
export function CsvImportTarget({
  plan,
  columnLabel,
  importable,
  propertiesById,
  usedElsewhere,
  nameTaken,
  disabled,
  onSelectNew,
  onSelectExisting,
  onRename,
}: CsvImportTargetProps) {
  const { t } = useTranslation();
  const isNew = plan.target.kind === "new";
  const currentId = plan.target.kind === "existing" ? plan.target.propertyId : NEW_PROPERTY;
  const property = plan.target.kind === "existing" ? propertiesById.get(currentId) : undefined;
  // null while the name isn't being edited, so outside renames show right away
  const [draft, setDraft] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const focusNameRef = useRef(false);

  const combobox = useCombobox({
    onDropdownClose: () => combobox.resetSelectedOption(),
    onDropdownOpen: () => combobox.updateSelectedOptionIndex("active", { scrollIntoView: true }),
  });

  // a column just switched to a new property gets the cursor in its name
  useEffect(() => {
    if (!isNew || !focusNameRef.current) return;
    focusNameRef.current = false;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [isNew]);

  // an emptied name goes back to the last one
  const commitName = () => {
    const name = (draft ?? plan.name).trim();
    setDraft(null);
    if (name && name !== plan.name) onRename(name);
  };

  const submit = (value: string) => {
    combobox.closeDropdown();
    if (value === NEW_PROPERTY) {
      if (isNew) return;
      setDraft(null);
      focusNameRef.current = true;
      onSelectNew();
      return;
    }
    setDraft(null);
    onSelectExisting(value);
  };

  const label = t("Import column {{name}} as", { name: columnLabel });

  return (
    <Combobox store={combobox} onOptionSubmit={submit}>
      <Combobox.Target targetType={isNew ? "input" : "button"}>
        {isNew ? (
          <TextInput
            ref={inputRef}
            size="xs"
            value={draft ?? plan.name}
            maxLength={MAX_PROPERTY_NAME_LENGTH}
            disabled={disabled}
            onFocus={() => setDraft(plan.name)}
            onChange={(event) => setDraft(event.currentTarget.value)}
            onBlur={() => {
              combobox.closeDropdown();
              commitName();
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !combobox.dropdownOpened) {
                event.preventDefault();
                event.currentTarget.blur();
              }
            }}
            leftSection={<IconPlus size={14} aria-hidden />}
            rightSection={
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                disabled={disabled}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => combobox.toggleDropdown()}
                aria-label={label}
              >
                <Combobox.Chevron />
              </ActionIcon>
            }
            rightSectionPointerEvents="all"
            error={nameTaken ? t("Another property has this name") : undefined}
            aria-label={t("New property name for column {{name}}", { name: columnLabel })}
          />
        ) : (
          <InputBase
            component="button"
            type="button"
            size="xs"
            pointer
            disabled={disabled}
            onClick={() => combobox.toggleDropdown()}
            leftSection={
              property ? <TypeIcon type={property.type as CsvImportPropertyType} /> : null
            }
            rightSection={<Combobox.Chevron />}
            rightSectionPointerEvents="none"
            aria-label={label}
          >
            <span className={classes.targetLabel}>{property?.name}</span>
          </InputBase>
        )}
      </Combobox.Target>

      <Combobox.Dropdown>
        <Combobox.Options>
          <ScrollArea.Autosize mah={250} type="scroll">
            <Combobox.Group label={t("New property")}>
              <Combobox.Option value={NEW_PROPERTY} active={isNew}>
                <TargetOption
                  icon={<IconPlus size={14} />}
                  label={isNew ? plan.name : plan.header}
                  active={isNew}
                />
              </Combobox.Option>
            </Combobox.Group>
            {importable.length > 0 && (
              <Combobox.Group label={t("Existing properties")}>
                {importable.map((p) => (
                  <Combobox.Option
                    key={p.id}
                    value={p.id}
                    active={p.id === currentId}
                    disabled={usedElsewhere.has(p.id)}
                  >
                    <TargetOption
                      icon={<TypeIcon type={p.type as CsvImportPropertyType} />}
                      label={p.name}
                      active={p.id === currentId}
                    />
                  </Combobox.Option>
                ))}
              </Combobox.Group>
            )}
          </ScrollArea.Autosize>
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
}

function TargetOption({
  icon,
  label,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
}) {
  return (
    <Group gap={8} wrap="nowrap">
      {icon}
      <Text size="xs" truncate style={{ flex: 1 }}>
        {label}
      </Text>
      {active && <CheckIcon size={10} />}
    </Group>
  );
}
