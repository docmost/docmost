import { ActionIcon, Menu, Tooltip } from "@mantine/core";
import {
  IconDots,
  IconHistory,
  IconLink,
  IconMessage,
} from "@tabler/icons-react";
import React from "react";
import useToggleAside from "@/hooks/use-toggle-aside.tsx";
import { useAtom } from "jotai";
import { historyAtoms } from "@/features/page-history/atoms/history-atoms.ts";
import { useClipboard } from "@mantine/hooks";
import { useParams } from "react-router-dom";
import { usePageQuery } from "@/features/page/queries/page-query.ts";
import { buildPageSlug } from "@/features/page/page.utils.ts";
import { notifications } from "@mantine/notifications";

export default function Header() {
  const toggleAside = useToggleAside();

  return (
    <>
      {/*
      <Button variant="default" style={{ border: "none" }} size="compact-sm">
        Share
      </Button>
      */}

      <Tooltip label="Comments" openDelay={250} withArrow>
        <ActionIcon
          variant="default"
          style={{ border: "none" }}
          onClick={() => toggleAside("comments")}
        >
          <IconMessage size={20} stroke={2} />
        </ActionIcon>
      </Tooltip>

      <PageActionMenu />
    </>
  );
}

function PageActionMenu() {
  const [, setHistoryModalOpen] = useAtom(historyAtoms);
  const clipboard = useClipboard({ timeout: 500 });
  const { slugId } = useParams();
  const { data: page, isLoading, isError } = usePageQuery(slugId);

  const handleCopyLink = () => {
    const pageLink =
      window.location.host + buildPageSlug(page.slugId, page.title);
    clipboard.copy(pageLink);
    notifications.show({ message: "Link copied" });
  };

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
        <Menu.Item
          leftSection={<IconLink size={16} stroke={2} />}
          onClick={handleCopyLink}
        >
          Copy link
        </Menu.Item>
        <Menu.Divider />
        <Menu.Item
          leftSection={<IconHistory size={16} stroke={2} />}
          onClick={openHistoryModal}
        >
          Page history
        </Menu.Item>

        {/*
        <Menu.Divider />
        <Menu.Item leftSection={<IconTrash size={16} stroke={2} />}>
          Delete
        </Menu.Item>
        */}
      </Menu.Dropdown>
    </Menu>
  );
}
