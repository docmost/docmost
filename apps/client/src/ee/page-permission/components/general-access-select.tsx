import { Group, Menu, Text, UnstyledButton } from "@mantine/core";
import {
  IconChevronDown,
  IconLock,
  IconShieldLock,
  IconCheck,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import classes from "./page-permission.module.css";

type AccessLevel = "open" | "restricted";

type GeneralAccessSelectProps = {
  value: AccessLevel;
  onChange: (value: AccessLevel) => void;
  disabled?: boolean;
  hasInheritedRestriction?: boolean;
};

export function GeneralAccessSelect({
  value,
  onChange,
  disabled,
  hasInheritedRestriction,
}: GeneralAccessSelectProps) {
  const { t } = useTranslation();

  const isDirectlyRestricted = value === "restricted";
  const showInheritedState = hasInheritedRestriction && !isDirectlyRestricted;

  const currentLabel = showInheritedState
    ? t("Restricted by parent")
    : isDirectlyRestricted
      ? t("Restricted")
      : t("Open");

  const currentDescription = showInheritedState
    ? t("Inherits restrictions from ancestor page")
    : isDirectlyRestricted
      ? t("Only people listed below can access this page")
      : t("Everyone in this space can access");

  const CurrentIcon = showInheritedState
    ? IconShieldLock
    : isDirectlyRestricted
      ? IconLock
      : IconShieldLock;

  const accessOptions = [
    {
      value: "open" as const,
      label: hasInheritedRestriction ? t("Restricted by parent") : t("Open"),
      description: hasInheritedRestriction
        ? t("Use only inherited restrictions")
        : t("No additional restrictions on this page"),
      icon: IconShieldLock,
    },
    {
      value: "restricted" as const,
      label: t("Restricted"),
      description: hasInheritedRestriction
        ? t("Add restrictions on top of inherited")
        : t("Only specific people can access"),
      icon: IconLock,
    },
  ];

  return (
    <Menu withArrow disabled={disabled}>
      <Menu.Target>
        <UnstyledButton className={classes.generalAccessBox} disabled={disabled}>
          <div
            className={`${classes.generalAccessIcon} ${isDirectlyRestricted || showInheritedState ? classes.generalAccessIconRestricted : ""}`}
          >
            <CurrentIcon size={18} stroke={1.5} />
          </div>
          <div style={{ flex: 1 }}>
            <Group gap={4}>
              <Text size="sm" fw={500}>
                {currentLabel}
              </Text>
              {!disabled && <IconChevronDown size={14} />}
            </Group>
            <Text size="xs" c="dimmed">
              {currentDescription}
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
