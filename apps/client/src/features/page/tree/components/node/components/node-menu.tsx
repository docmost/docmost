import { useClipboard } from "@mantine/hooks";
import { useParams } from "react-router-dom";
import { useDeletePageModal } from "@/features/page/hooks/use-delete-page-modal.tsx";
import { getAppUrl } from "@/lib/config.ts";
import { buildPageUrl } from "@/features/page/page.utils.ts";
import { notifications } from "@mantine/notifications";
import { ActionIcon, Menu, rem } from "@mantine/core";
import { IconDotsVertical, IconLink, IconTrash } from "@tabler/icons-react";
import React from "react";
import { NodeApi, TreeApi } from "react-arborist";
import { SpaceTreeNode } from "@/features/page/tree/types.ts";

interface NodeMenuProps {
  node: NodeApi<SpaceTreeNode>;
  treeApi: TreeApi<SpaceTreeNode>;
}

export function NodeMenu({ node, treeApi }: NodeMenuProps) {
  const clipboard = useClipboard({ timeout: 500 });
  const { spaceSlug } = useParams();
  const { openDeleteModal } = useDeletePageModal();

  const handleCopyLink = () => {
    const pageUrl =
      getAppUrl() + buildPageUrl(spaceSlug, node.data.slugId, node.data.name);
    clipboard.copy(pageUrl);
    notifications.show({ message: "Link copied" });
  };

  return (
    <Menu shadow="md" width={200}>
      <Menu.Target>
        <ActionIcon
          variant="transparent"
          c="gray"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <IconDotsVertical
            style={{ width: rem(20), height: rem(20) }}
            stroke={2}
          />
        </ActionIcon>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Item
          leftSection={<IconLink style={{ width: rem(14), height: rem(14) }} />}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleCopyLink();
          }}
        >
          Copy link
        </Menu.Item>

        {!(treeApi.props.disableEdit as boolean) && (
          <>
            <Menu.Divider />

            <Menu.Item
              c="red"
              leftSection={
                <IconTrash style={{ width: rem(14), height: rem(14) }} />
              }
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                openDeleteModal({ onConfirm: () => treeApi?.delete(node) });
              }}
            >
              Delete
            </Menu.Item>
          </>
        )}
      </Menu.Dropdown>
    </Menu>
  );
}
