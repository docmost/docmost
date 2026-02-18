import { IconSearch } from "@tabler/icons-react";
import cx from "clsx";
import {
  ActionIcon,
  BoxProps,
  ElementProps,
  Group,
  rem,
  Text,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import classes from "./search-control.module.css";
import React from "react";
import { useTranslation } from "react-i18next";

interface SearchControlProps extends BoxProps, ElementProps<"button"> {}

export function SearchControl({ className, ...others }: SearchControlProps) {
  const { t } = useTranslation();

  return (
    <UnstyledButton {...others} className={cx(classes.root, className)}>
      <Group gap="xs" wrap="nowrap">
        <IconSearch style={{ width: rem(15), height: rem(15) }} stroke={1.75} />
        <Text fz="sm" className={classes.label}>
          {t("Search")}
        </Text>
        <Text fw={700} className={classes.shortcut}>
          Ctrl + K
        </Text>
      </Group>
    </UnstyledButton>
  );
}

interface SearchMobileControlProps {
  onSearch: () => void;
}

export function SearchMobileControl({ onSearch }: SearchMobileControlProps) {
  const { t } = useTranslation();

  return (
    <Tooltip label={t("Search")} withArrow>
      <ActionIcon variant="subtle" onClick={onSearch} size="sm">
        <IconSearch size={18} stroke={1.75} />
      </ActionIcon>
    </Tooltip>
  );
}
