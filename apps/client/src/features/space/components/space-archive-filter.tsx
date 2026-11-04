import { Button, Menu } from "@mantine/core";
import { IconArchive, IconCheck, IconChevronDown } from "@tabler/icons-react";
import cx from "clsx";
import { useTranslation } from "react-i18next";
import { RadioMenuItem } from "@/components/ui/radio-menu-item";
import classes from "@/features/search/components/search-spotlight-filters.module.css";

interface SpaceArchiveFilterProps {
  archived: boolean;
  onChange: (archived: boolean) => void;
}

export default function SpaceArchiveFilter({
  archived,
  onChange,
}: SpaceArchiveFilterProps) {
  const { t } = useTranslation();
  const options = [
    { archived: false, label: t("Active") },
    { archived: true, label: t("Archived") },
  ];

  return (
    <Menu shadow="md" width={180} position="bottom-start">
      <Menu.Target>
        <Button
          variant={archived ? "light" : "subtle"}
          color={archived ? "blue" : "gray"}
          size="sm"
          radius="xl"
          leftSection={<IconArchive size={16} />}
          rightSection={<IconChevronDown size={14} />}
          className={cx(
            classes.filterButton,
            archived && classes.filterButtonActive,
          )}
          fw={500}
          aria-label={archived ? t("Archived spaces") : t("Active spaces")}
        >
          {archived ? t("Archived") : t("Active")}
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        {options.map((option) => (
          <Menu.Item
            key={option.label}
            component={RadioMenuItem}
            aria-checked={archived === option.archived}
            rightSection={
              archived === option.archived && (
                <IconCheck size={16} aria-hidden />
              )
            }
            onClick={() =>
              archived !== option.archived && onChange(option.archived)
            }
          >
            {option.label}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}
