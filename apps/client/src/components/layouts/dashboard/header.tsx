import { ActionIcon, Menu, Button } from "@mantine/core";
import {
  IconDots,
  IconFileInfo,
  IconHistory,
  IconLink,
  IconLock,
  IconShare,
  IconTrash,
  IconMessage,
} from "@tabler/icons-react";
import React from "react";
import useToggleAside from "@/hooks/use-toggle-aside.tsx";
import { useAtom } from "jotai";
import { historyAtoms } from "@/features/page-history/atoms/history-atoms.ts";

export default function Header() {
  const toggleAside = useToggleAside();

  return (
    <>
      <Button variant="default" style={{ border: "none" }} size="compact-sm">
        Share
      </Button>

      <ActionIcon
        variant="default"
        style={{ border: "none" }}
        onClick={() => toggleAside("comments")}
      >
        <IconMessage size={20} stroke={2} />
      </ActionIcon>

      <PageActionMenu />
    </>
  );
}

function PageActionMenu() {
  const [, setHistoryModalOpen] = useAtom(historyAtoms);

  const openHistoryModal = () => {
    setHistoryModalOpen(true);
  };

  return (
    <Menu
      shadow="xl"
      position="bottom-end"
      offset={20}
      width={200}
      withArrow
      arrowPosition="center"
    >
      <Menu.Target>
        <ActionIcon variant="default" style={{ border: "none" }}>
          <IconDots size={20} stroke={2} />
        </ActionIcon>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Item leftSection={<IconFileInfo size={16} stroke={2} />}>
          Page info
        </Menu.Item>
        <Menu.Item leftSection={<IconLink size={16} stroke={2} />}>
          Copy link
        </Menu.Item>
        <Menu.Item leftSection={<IconShare size={16} stroke={2} />}>
          Share
        </Menu.Item>
        <Menu.Item
          leftSection={<IconHistory size={16} stroke={2} />}
          onClick={openHistoryModal}
        >
          Page history
        </Menu.Item>

        <Menu.Divider />
        <Menu.Item leftSection={<IconLock size={16} stroke={2} />}>
          Lock
        </Menu.Item>
        <Menu.Item leftSection={<IconTrash size={16} stroke={2} />}>
          Delete
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
