import { ActionIcon, Menu, Tooltip } from "@mantine/core";
import { IconChevronDown } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import type { TabActions } from "./tabs.types";

type TabActionsMenuProps = {
  index: number;
  tabCount: number;
  label: string;
  actions: TabActions;
};

export default function TabActionsMenu({
  index,
  tabCount,
  label,
  actions,
}: TabActionsMenuProps) {
  const { t } = useTranslation();

  return (
    <Menu position="bottom-start" shadow="md" width={200}>
      <Menu.Target>
        <Tooltip label={t("Tab actions")}>
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            aria-label={t("Tab actions for {{name}}", {
              name: label || t("Untitled"),
            })}
          >
            <IconChevronDown size={14} />
          </ActionIcon>
        </Tooltip>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item onClick={() => actions.rename(index)}>
          {t("Rename")}
        </Menu.Item>
        <Menu.Item onClick={() => actions.duplicate(index)}>
          {t("Duplicate")}
        </Menu.Item>
        <Menu.Item
          disabled={index === 0}
          onClick={() => actions.move(index, index - 1)}
        >
          {t("Move left")}
        </Menu.Item>
        <Menu.Item
          disabled={index === tabCount - 1}
          onClick={() => actions.move(index, index + 1)}
        >
          {t("Move right")}
        </Menu.Item>
        <Menu.Item color="red" onClick={() => actions.remove(index)}>
          {t("Delete tab")}
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
