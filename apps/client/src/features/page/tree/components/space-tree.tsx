import { NodeApi, NodeRendererProps, Tree, TreeApi } from "react-arborist";
import { useAtom } from "jotai";
import { treeApiAtom } from "@/features/page/tree/atoms/tree-api-atom.ts";
import {
  useGetRootSidebarPagesQuery,
  useUpdatePageMutation,
} from "@/features/page/queries/page-query.ts";
import React, { useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import classes from "@/features/page/tree/styles/tree.module.css";
import { FillFlexParent } from "@/features/page/tree/components/fill-flex-parent.tsx";
import { ActionIcon, Menu, rem } from "@mantine/core";
import {
  IconChevronDown,
  IconChevronRight,
  IconDotsVertical,
  IconFileDescription,
  IconLink,
  IconPlus,
  IconPointFilled,
  IconStar,
  IconTrash,
} from "@tabler/icons-react";
import { treeDataAtom } from "@/features/page/tree/atoms/tree-data-atom.ts";
import clsx from "clsx";
import EmojiPicker from "@/components/ui/emoji-picker.tsx";
import { useTreeMutation } from "@/features/page/tree/hooks/use-tree-mutation.ts";
import {
  buildTree,
  updateTreeNodeIcon,
} from "@/features/page/tree/utils/utils.ts";
import { SpaceTreeNode } from "@/features/page/tree/types.ts";
import { getSidebarPages } from "@/features/page/services/page-service.ts";
import { SidebarPagesParams } from "@/features/page/types/page.types.ts";
import { queryClient } from "@/main.tsx";

interface SpaceTreeProps {
  spaceId: string;
}

export default function SpaceTree({ spaceId }: SpaceTreeProps) {
  const { data, setData, controllers } =
    useTreeMutation<TreeApi<SpaceTreeNode>>(spaceId);
  const [treeAPi, setTreeApi] = useAtom<TreeApi<SpaceTreeNode>>(treeApiAtom);
  const {
    data: pagesData,
    hasNextPage,
    fetchNextPage,
    isFetching,
  } = useGetRootSidebarPagesQuery({
    spaceId,
  });
  const rootElement = useRef<HTMLDivElement>();
  const { pageId } = useParams();

  useEffect(() => {
    if (hasNextPage && !isFetching) {
      fetchNextPage();
    }
  }, [hasNextPage, fetchNextPage, isFetching]);

  useEffect(() => {
    if (pagesData?.pages && !hasNextPage) {
      const allItems = pagesData.pages.flatMap((page) => page.items);
      const treeData = buildTree(allItems);
      setData(treeData);
    }
  }, [pagesData, hasNextPage]);

  useEffect(() => {
    setTimeout(() => {
      treeAPi?.select(pageId, { align: "auto" });
    }, 200);
  }, [treeAPi, pageId]);

  return (
    <div ref={rootElement} className={classes.treeContainer}>
      <FillFlexParent>
        {(dimens) => (
          <Tree
            data={data}
            {...controllers}
            {...dimens}
            // @ts-ignore
            ref={(t) => setTreeApi(t)}
            openByDefault={false}
            disableMultiSelection={true}
            className={classes.tree}
            rowClassName={classes.row}
            rowHeight={30}
            overscanCount={8}
            dndRootElement={rootElement.current}
            selectionFollowsFocus
          >
            {Node}
          </Tree>
        )}
      </FillFlexParent>
    </div>
  );
}

function Node({ node, style, dragHandle }: NodeRendererProps<any>) {
  const navigate = useNavigate();
  const updatePageMutation = useUpdatePageMutation();
  const [treeData, setTreeData] = useAtom(treeDataAtom);

  function updateTreeData(
    treeItems: SpaceTreeNode[],
    nodeId: string,
    children: SpaceTreeNode[],
  ) {
    return treeItems.map((nodeItem) => {
      if (nodeItem.id === nodeId) {
        return { ...nodeItem, children };
      }
      if (nodeItem.children) {
        return {
          ...nodeItem,
          children: updateTreeData(nodeItem.children, nodeId, children),
        };
      }
      return nodeItem;
    });
  }

  async function handleLoadChildren(node: NodeApi<SpaceTreeNode>) {
    if (!node.data.hasChildren) return;
    if (node.data.children && node.data.children.length > 0) {
      return;
    }

    try {
      const params: SidebarPagesParams = {
        pageId: node.data.id,
        spaceId: node.data.spaceId,
      };

      const newChildren = await queryClient.fetchQuery({
        queryKey: ["sidebar-pages", params],
        queryFn: () => getSidebarPages(params),
      });

      const childrenTree = buildTree(newChildren.items);

      const updatedTreeData = updateTreeData(
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
    navigate(`/p/${node.id}`);
  };

  const handleUpdateNodeIcon = (nodeId: string, newIcon: string) => {
    const updatedTree = updateTreeNodeIcon(treeData, node.id, newIcon);
    setTreeData(updatedTree);
  };

  const handleEmojiIconClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleEmojiSelect = (emoji: { native: string }) => {
    handleUpdateNodeIcon(node.id, emoji.native);
    updatePageMutation.mutateAsync({ pageId: node.id, icon: emoji.native });
  };

  const handleRemoveEmoji = () => {
    handleUpdateNodeIcon(node.id, null);
    updatePageMutation.mutateAsync({ pageId: node.id, icon: null });
  };

  if (node.willReceiveDrop && node.isClosed) {
    handleLoadChildren(node);
    setTimeout(() => {
      if (node.state.willReceiveDrop) node.open();
    }, 650);
  }

  return (
    <>
      <div
        style={style}
        className={clsx(classes.node, node.state)}
        ref={dragHandle}
        onClick={handleClick}
      >
        <PageArrow node={node} onExpandTree={() => handleLoadChildren(node)} />

        <div onClick={handleEmojiIconClick} style={{ marginRight: "4px" }}>
          <EmojiPicker
            onEmojiSelect={handleEmojiSelect}
            icon={
              node.data.icon ? (
                node.data.icon
              ) : (
                <IconFileDescription size="18px" />
              )
            }
            removeEmojiAction={handleRemoveEmoji}
          />
        </div>

        <span className={classes.text}>{node.data.name || "untitled"}</span>

        <div className={classes.actions}>
          <NodeMenu node={node} />
          <CreateNode
            node={node}
            onExpandTree={() => handleLoadChildren(node)}
          />
        </div>
      </div>
    </>
  );
}

interface CreateNodeProps {
  node: NodeApi<SpaceTreeNode>;
  onExpandTree?: () => void;
}
function CreateNode({ node, onExpandTree }: CreateNodeProps) {
  const [treeApi] = useAtom(treeApiAtom);

  function handleCreate() {
    if (node.data.hasChildren && node.children.length === 0) {
      node.toggle();
      onExpandTree();

      setTimeout(() => {
        treeApi?.create({ type: "internal", parentId: node.id, index: 0 });
      }, 500);
    } else {
      treeApi?.create({ type: "internal", parentId: node.id });
    }
  }

  return (
    <ActionIcon
      variant="transparent"
      c="gray"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        handleCreate();
      }}
    >
      <IconPlus style={{ width: rem(20), height: rem(20) }} stroke={2} />
    </ActionIcon>
  );
}

function NodeMenu({ node }: { node: NodeApi<SpaceTreeNode> }) {
  const [treeApi] = useAtom(treeApiAtom);

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
          leftSection={<IconStar style={{ width: rem(14), height: rem(14) }} />}
        >
          Favorite
        </Menu.Item>

        <Menu.Divider />

        <Menu.Item
          leftSection={<IconLink style={{ width: rem(14), height: rem(14) }} />}
        >
          Copy link
        </Menu.Item>

        <Menu.Divider />
        <Menu.Item
          c="red"
          leftSection={
            <IconTrash style={{ width: rem(14), height: rem(14) }} />
          }
          onClick={() => treeApi?.delete(node)}
        >
          Delete
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
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
        ) : (
          <IconPointFilled size={8} />
        )
      ) : null}
    </ActionIcon>
  );
}
