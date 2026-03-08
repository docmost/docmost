import { UnstyledButton, Group, Text } from "@mantine/core";
import {
  IconLetterT,
  IconHash,
  IconCircleDot,
  IconProgressCheck,
  IconTags,
  IconCalendar,
  IconUser,
  IconPaperclip,
  IconCheckbox,
  IconLink,
  IconMail,
  IconClockPlus,
  IconClockEdit,
  IconUserEdit,
  IconCheck,
} from "@tabler/icons-react";
import { BasePropertyType } from "@/features/base/types/base.types";
import { useTranslation } from "react-i18next";
import classes from "@/features/base/styles/cells.module.css";

const propertyTypes: {
  type: BasePropertyType;
  icon: typeof IconLetterT;
  labelKey: string;
}[] = [
  { type: "text", icon: IconLetterT, labelKey: "Text" },
  { type: "number", icon: IconHash, labelKey: "Number" },
  { type: "select", icon: IconCircleDot, labelKey: "Select" },
  { type: "status", icon: IconProgressCheck, labelKey: "Status" },
  { type: "multiSelect", icon: IconTags, labelKey: "Multi-select" },
  { type: "date", icon: IconCalendar, labelKey: "Date" },
  { type: "person", icon: IconUser, labelKey: "Person" },
  { type: "file", icon: IconPaperclip, labelKey: "File" },
  { type: "checkbox", icon: IconCheckbox, labelKey: "Checkbox" },
  { type: "url", icon: IconLink, labelKey: "URL" },
  { type: "email", icon: IconMail, labelKey: "Email" },
  { type: "createdAt", icon: IconClockPlus, labelKey: "Created at" },
  { type: "lastEditedAt", icon: IconClockEdit, labelKey: "Last edited at" },
  { type: "lastEditedBy", icon: IconUserEdit, labelKey: "Last edited by" },
];

type PropertyTypePickerProps = {
  onSelect: (type: BasePropertyType) => void;
  currentType?: BasePropertyType;
  excludeTypes?: Set<BasePropertyType>;
};

export function PropertyTypePicker({
  onSelect,
  currentType,
  excludeTypes,
}: PropertyTypePickerProps) {
  const { t } = useTranslation();

  const types = excludeTypes
    ? propertyTypes.filter(({ type }) => !excludeTypes.has(type))
    : propertyTypes;

  return (
    <>
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

export { propertyTypes };
