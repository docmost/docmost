import { Group, Menu, Text, UnstyledButton } from "@mantine/core";
import {
  IconChevronDown,
  IconLock,
  IconWorld,
  IconCheck,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import classes from "./page-permission.module.css";

type AccessLevel = "open" | "restricted";

type GeneralAccessSelectProps = {
  value: AccessLevel;
  onChange: (value: AccessLevel) => void;
  disabled?: boolean;
  isInherited?: boolean;
};

export function GeneralAccessSelect({
  value,
  onChange,
  disabled,
  isInherited,
}: GeneralAccessSelectProps) {
  const { t } = useTranslation();

  const isRestricted = value === "restricted";

  const accessOptions = [
    {
      value: "open" as const,
      label: t("Open"),
      description: t("Everyone in this space can access"),
      icon: IconWorld,
    },
    {
      value: "restricted" as const,
      label: t("Restricted"),
      description: t("Only specific people can view or edit"),
      icon: IconLock,
    },
  ];

  const currentOption = accessOptions.find((opt) => opt.value === value);
  const Icon = currentOption?.icon || IconWorld;

  if (isInherited) {
    return (
      <Group className={classes.generalAccessBox}>
        <div
          className={`${classes.generalAccessIcon} ${isRestricted ? classes.generalAccessIconRestricted : ""}`}
        >
          <Icon size={18} stroke={1.5} />
        </div>
        <div>
          <Text size="sm" fw={500}>
            {currentOption?.label}
          </Text>
          <Text size="xs" c="dimmed">
            {currentOption?.description}
          </Text>
        </div>
      </Group>
    );
  }

  return (
    <Menu withArrow disabled={disabled}>
      <Menu.Target>
        <UnstyledButton className={classes.generalAccessBox}>
          <div
            className={`${classes.generalAccessIcon} ${isRestricted ? classes.generalAccessIconRestricted : ""}`}
          >
            <Icon size={18} stroke={1.5} />
          </div>
          <div style={{ flex: 1 }}>
            <Group gap={4}>
              <Text size="sm" fw={500}>
                {currentOption?.label}
              </Text>
              {!disabled && <IconChevronDown size={14} />}
            </Group>
            <Text size="xs" c="dimmed">
              {currentOption?.description}
            </Text>
          </div>
        </UnstyledButton>
      </Menu.Target>

      <Menu.Dropdown>
        {accessOptions.map((option) => (
          <Menu.Item
            key={option.value}
            onClick={() => onChange(option.value)}
            leftSection={<option.icon size={16} stroke={1.5} />}
            rightSection={
              option.value === value ? <IconCheck size={16} /> : null
            }
          >
            <div>
              <Text size="sm">{option.label}</Text>
              <Text size="xs" c="dimmed">
                {option.description}
              </Text>
            </div>
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}
