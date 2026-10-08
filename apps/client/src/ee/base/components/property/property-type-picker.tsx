import { UnstyledButton, Group, Text, TextInput } from "@mantine/core";
import { IconCheck, IconSearch } from "@tabler/icons-react";
import { BasePropertyType } from "@/ee/base/types/base.types";
import { propertyTypes } from "@/ee/base/property-types/property-type.registry";
import { useTranslation } from "react-i18next";
import { useState, useRef, useEffect } from "react";
import classes from "@/ee/base/styles/cells.module.css";

type PropertyTypePickerProps = {
  onSelect: (type: BasePropertyType) => void;
  currentType?: BasePropertyType;
  excludeTypes?: Set<BasePropertyType>;
  showSearch?: boolean;
};

export function PropertyTypePicker({
  onSelect,
  currentType,
  excludeTypes,
  showSearch,
}: PropertyTypePickerProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showSearch) {
      setTimeout(() => searchRef.current?.focus(), 0);
    }
  }, [showSearch]);

  const types = propertyTypes
    .filter(({ type }) => !excludeTypes?.has(type))
    .filter(({ labelKey }) =>
      !search || t(labelKey).toLowerCase().includes(search.toLowerCase())
    );

  return (
    <>
      {showSearch && (
        <TextInput
          ref={searchRef}
          size="xs"
          placeholder={t("Find a property type")}
          leftSection={<IconSearch size={14} />}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          mx="sm"
          mt="sm"
          mb={4}
        />
      )}
      {types.map(({ type, icon: Icon, labelKey }) => (
        <UnstyledButton
          key={type}
          className={classes.menuItem}
          onClick={() => onSelect(type)}
          style={{
            fontWeight: type === currentType ? 600 : 400,
          }}
        >
          <Group gap={8} wrap="nowrap" style={{ flex: 1 }}>
            <Icon size={14} />
            <Text size="sm">{t(labelKey)}</Text>
          </Group>
          {type === currentType && <IconCheck size={14} />}
        </UnstyledButton>
      ))}
    </>
  );
}
