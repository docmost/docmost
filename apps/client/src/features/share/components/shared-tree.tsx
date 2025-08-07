import { ISharedPageTree } from "@/features/share/types/share.types.ts";
import {
  buildSharedPageTree,
  SharedPageTreeNode,
} from "@/features/share/utils.ts";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAtom } from "jotai/index";
import { useTranslation } from "react-i18next";
import { buildSharedPageUrl } from "@/features/page/page.utils.ts";
import clsx from "clsx";
import {
  IconChevronDown,
  IconChevronRight,
  IconFileDescription,
  IconPointFilled,
} from "@tabler/icons-react";
import { ActionIcon, Box } from "@mantine/core";
import { extractPageSlugId } from "@/lib";
import classes from "@/features/page/tree/styles/tree.module.css";
import styles from "./share.module.css";
import { mobileSidebarAtom } from "@/components/layouts/global/hooks/atoms/sidebar-atom.ts";
import EmojiPicker from "@/components/ui/emoji-picker.tsx";
import { useTree as useHeadlessTree } from "@headless-tree/react/react17";
import { 
  selectionFeature,
  hotkeysCoreFeature,
  type FeatureImplementation,
  type ItemInstance, 
  syncDataLoaderFeature,
  expandAllFeature
} from "@headless-tree/core";

interface SharedTree {
  sharedPageTree: ISharedPageTree;
}

declare module "@headless-tree/core" {
  export interface TreeConfig<T> {
    activeItemId?: string;
  }
  export interface ItemInstance<T> {
    isActive: () => boolean;
  }
}

const headlessTreeExtensions: FeatureImplementation<SharedPageTreeNode> = {
  itemInstance: {
    isActive: ({itemId, tree}) => tree.getConfig().activeItemId === itemId,
  },
};

export default function SharedTree({ sharedPageTree }: SharedTree) {
  const { pageSlug, shareId } = useParams();
  const { t } = useTranslation();
  const [, setMobileSidebarState] = useAtom(mobileSidebarAtom);

  const currentNodeId = extractPageSlugId(pageSlug);

  const treeData: SharedPageTreeNode[] = useMemo(() => {
    if (!sharedPageTree?.pageTree) return [];
    return buildSharedPageTree(sharedPageTree.pageTree);
  }, [sharedPageTree?.pageTree]);

  const flatItemsMap = useMemo(() => {
    const map: Record<string, SharedPageTreeNode> = {};
    
    function traverse(nodes: SharedPageTreeNode[]) {
      for (const node of nodes) {
        map[node.slugId] = node;
        if (node.children && node.children.length > 0) {
          traverse(node.children);
        }
      }
    }
    
    traverse(treeData);
    return map;
  }, [treeData]);

  const tree = useHeadlessTree<SharedPageTreeNode>({
    rootItemId: "root",
    activeItemId: currentNodeId,
    getItemName: item => item.getItemData()?.name ?? t("untitled"),
    isItemFolder: item => {
      const data = item.getItemData();
      return data?.hasChildren || (data?.children && data.children.length > 0);
    },
    dataLoader: {
      getItem: itemId => {
        return flatItemsMap[itemId] || null;
      },
      getChildren: itemId => {
        const children = itemId === "root" ? treeData : flatItemsMap[itemId]?.children || [];
        return children.map(item => item.id);
      }
    },
    indent: 20,
    features: [
      syncDataLoaderFeature,
      selectionFeature,
      hotkeysCoreFeature,
      headlessTreeExtensions,
      expandAllFeature
    ]
  });

  useEffect(() => {
    tree.expandAll();
  }, [tree]);

  if (!sharedPageTree || !sharedPageTree?.pageTree) {
    return null;
  }

  return (
    <div className={classes.treeContainer}>
      <div {...tree.getContainerProps()} className="tree">
        {tree.getItems().map((item) => (
          <Node
            key={item.getId()}
            item={item}
            shareId={shareId}
            onMobileSidebarClose={() => setMobileSidebarState(false)}
          />
        ))}
      </div>
    </div>
  );
}

function Node({ item, shareId, onMobileSidebarClose }: {
  item: ItemInstance<SharedPageTreeNode>;
  shareId: string;
  onMobileSidebarClose: () => void;
}) {
  const { t } = useTranslation();

  const data = item.getItemData();
  if (!data) {
    console.warn("Item data is missing for item:", item.getId());
    return null;
  }

  const pageUrl = buildSharedPageUrl({
    shareId: shareId,
    pageSlugId: data.slugId,
    pageTitle: data.name,
  });

  return (
    <>
      <Box
        {...item.getProps()}
        style={{ paddingLeft: `${item.getItemMeta().level * 20}px` }}
        className={clsx(
          classes.node, 
          item.isActive() && classes.isSelected,
          item.isFocused() && classes.isFocused,
          styles.treeNode
        )}
        component={Link}
        to={pageUrl}
        onClick={() => {
          onMobileSidebarClose();
        }}
      >
        <PageArrow item={item} />
        <div style={{ marginRight: "4px" }}>
          <EmojiPicker
            onEmojiSelect={() => {}}
            icon={
              data.icon ? (
                data.icon
              ) : (
                <IconFileDescription size="18" />
              )
            }
            readOnly={true}
            removeEmojiAction={() => {}}
          />
        </div>
        <span className={classes.text}>{data.name || t("untitled")}</span>
      </Box>
    </>
  );
}

interface PageArrowProps {
  item: ItemInstance<SharedPageTreeNode>;
}

function PageArrow({ item }: PageArrowProps) {
  const [isFolder, setIsFolder] = useState(false);

  useEffect(() => {
    // isFolder() will dispatch retrieval of children if not loaded,
    // so let's not call that during render
    setIsFolder(item.isFolder());
  });

  return (
    <ActionIcon
      size={20}
      variant="subtle"
      c="gray"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isFolder) return;
        if (item.isExpanded()) {
          item.collapse();
        } else {
          item.expand();
        }
      }}
    >
      {isFolder ? (
        item.isExpanded() ? (
          <IconChevronDown stroke={2} size={16} />
        ) : (
          <IconChevronRight stroke={2} size={16} />
        )
      ) : (
        <IconPointFilled size={4} />
      )}
    </ActionIcon>
  );
}
