import { NodeApi, NodeRendererProps } from "react-arborist";
import { useAtom } from "jotai";
import { useUpdatePageMutation } from "@/features/page/queries/page-query.ts";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import classes from "@/features/page/tree/styles/tree.module.css";
import { ActionIcon, Group } from "@mantine/core";
import {
  IconChevronDown,
  IconChevronRight,
  IconFileDescription,
  IconLink,
} from "@tabler/icons-react";
import { treeDataAtom } from "@/features/page/tree/atoms/tree-data-atom.ts";
import clsx from "clsx";
import EmojiPicker from "@/components/ui/emoji-picker.tsx";
import {
  appendNodeChildren,
  buildTree,
  updateTreeNodeIcon,
} from "@/features/page/tree/utils/utils.ts";
import { SpaceTreeNode } from "@/features/page/tree/types.ts";
import {
  getMyPages,
  getPageById,
} from "@/features/page/services/page-service.ts";
import { queryClient } from "@/main.tsx";
import { useQueryEmit } from "@/features/websocket/use-query-emit.ts";
import { useTranslation } from "react-i18next";
import { personalSpaceIdAtom } from "@/features/page/tree/atoms/tree-current-space-atom.ts";
import { CreateNode } from "./my-page-tree-create-node.tsx";
import { MyPageNodeMenu } from "./my-page-tree-node-menu.tsx";
import { getPageColorAtom } from "@/features/page/tree/atoms/tree-color-atom.ts";
import { usePageColors } from "../../hooks/use-page-colors.ts";

export function Node({
  node,
  style,
  dragHandle,
  tree,
}: NodeRendererProps<any>) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { loadColors } = usePageColors();

  const updatePageMutation = useUpdatePageMutation();

  const [getPageColors] = useAtom(getPageColorAtom);
  const [treeData, setTreeData] = useAtom(treeDataAtom);
  const [personalSpaceId] = useAtom(personalSpaceIdAtom);

  const [pageColor, setPageColor] = useState<string>("");

  const emit = useQueryEmit();
  const timerRef = useRef(null);

  const [isPersonalSpace, setIsPersonalSpace] = useState(false);

  useEffect(() => {
    let rootPage = node;
    while (rootPage.level > 0) {
      rootPage = rootPage?.parent;
    }

    setIsPersonalSpace(rootPage.data.spaceId === personalSpaceId);
  }, [node.parent, personalSpaceId, node.tree]);

  useEffect(() => {
    setPageColor(getPageColors(node.data.id) || "#4CAF50");
  }, [getPageColors, node.data.id]);

  const prefetchPage = () => {
    timerRef.current = setTimeout(() => {
      queryClient.prefetchQuery({
        queryKey: ["pages", node.data.slugId],
        queryFn: () => getPageById({ pageId: node.data.slugId }),
        staleTime: 5 * 60 * 1000,
      });
    }, 150);
  };

  const cancelPagePrefetch = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  async function handleLoadChildren(node: NodeApi<SpaceTreeNode>) {
    if (!node.data.hasChildren) return;
    if (node.data.children && node.data.children.length > 0) {
      return;
    }

    try {
      const newChildren = await getMyPages(node.data.id);
      const childrenTree = buildTree(newChildren.items);

      loadColors(newChildren.items);

      const updatedTreeData = appendNodeChildren(
        treeData,
        node.data.id,
        childrenTree,
      );

      setTreeData(updatedTreeData);
    } catch (error) {
      console.error("Failed to fetch children:", error);
    }
  }

  const handleClick = () => {
    navigate(`/my-pages/${node.data.id}`);
  };

  const handleUpdateNodeIcon = (nodeId: string, newIcon: string) => {
    const updatedTree = updateTreeNodeIcon(treeData, nodeId, newIcon);
    setTreeData(updatedTree);
  };

  const handleEmojiIconClick = (e: any) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleEmojiSelect = (emoji: { native: string }) => {
    handleUpdateNodeIcon(node.id, emoji.native);
    updatePageMutation.mutateAsync({ pageId: node.id, icon: emoji.native });

    setTimeout(() => {
      emit({
        operation: "updateOne",
        spaceId: node.data.spaceId,
        entity: ["pages"],
        id: node.id,
        payload: { icon: emoji.native },
      });
    }, 50);
  };

  const handleRemoveEmoji = () => {
    handleUpdateNodeIcon(node.id, null);
    updatePageMutation.mutateAsync({ pageId: node.id, icon: null });

    setTimeout(() => {
      emit({
        operation: "updateOne",
        spaceId: node.data.spaceId,
        entity: ["pages"],
        id: node.id,
        payload: { icon: null },
      });
    }, 50);
  };

  if (
    node.willReceiveDrop &&
    node.isClosed &&
    (node.children.length > 0 || node.data.hasChildren)
  ) {
    handleLoadChildren(node);
    setTimeout(() => {
      if (node.state.willReceiveDrop) {
        node.open();
      }
    }, 650);
  }

  return (
    <>
      <div
        style={style}
        className={clsx(classes.node, node.state)}
        ref={dragHandle}
        onClick={handleClick}
        onMouseEnter={prefetchPage}
        onMouseLeave={cancelPagePrefetch}
      >
        {!isPersonalSpace && (
          <i
            className={classes.coloredNode}
            style={{ backgroundColor: pageColor }}
          ></i>
        )}

        <PageArrow node={node} onExpandTree={() => handleLoadChildren(node)} />
        <div onClick={handleEmojiIconClick} style={{ marginRight: "4px" }}>
          <EmojiPicker
            onEmojiSelect={handleEmojiSelect}
            icon={
              node.data.icon ? (
                node.data.icon
              ) : (
                <IconFileDescription size="18" />
              )
            }
            readOnly={tree.props.disableEdit as boolean}
            removeEmojiAction={handleRemoveEmoji}
          />
        </div>
        <span className={classes.text}>{node.data.name || t("untitled")}</span>
        {node.data.isSynced && (
          <div className={classes.syncIndicator} title="Synced">
            <IconLink size={18} />
          </div>
        )}
        <Group gap="xs" className={classes.actions}>
          {!tree.props.disableEdit && (
            <CreateNode
              node={node}
              treeApi={tree}
              onExpandTree={() => handleLoadChildren(node)}
            />
          )}
          <MyPageNodeMenu
            node={node}
            treeApi={tree}
            isPersonalSpace={isPersonalSpace}
          />
        </Group>
      </div>
    </>
  );
}

interface PageArrowProps {
  node: NodeApi<SpaceTreeNode>;
  onExpandTree?: () => void;
}

function PageArrow({ node, onExpandTree }: PageArrowProps) {
  return (
    <ActionIcon
      size={20}
      variant="subtle"
      c="gray"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        node.toggle();
        onExpandTree();
      }}
    >
      {node.isInternal ? (
        node.children && (node.children.length > 0 || node.data.hasChildren) ? (
          node.isOpen ? (
            <IconChevronDown stroke={2} size={18} />
          ) : (
            <IconChevronRight stroke={2} size={18} />
          )
        ) : // <IconPointFilled size={8} />
        null
      ) : null}
    </ActionIcon>
  );
}
