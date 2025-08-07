import { atom, useAtom, useSetAtom } from "jotai";
import {
  fetchAllAncestorChildren,
  useGetRootSidebarPagesQuery,
  usePageQuery,
  useUpdatePageMutation,
} from "@/features/page/queries/page-query.ts";
import { useEffect, useRef, useState } from "react";
import { data, Link, useParams } from "react-router-dom";
import classes from "@/features/page/tree/styles/tree.module.css";
import { ActionIcon, Box, Menu, rem } from "@mantine/core";
import {
  IconArrowRight,
  IconChevronDown,
  IconChevronRight,
  IconCopy,
  IconDotsVertical,
  IconFileDescription,
  IconFileExport,
  IconLink,
  IconPlus,
  IconPointFilled,
  IconTrash,
} from "@tabler/icons-react";
import clsx from "clsx";
import EmojiPicker from "@/components/ui/emoji-picker.tsx";
import { useTreeMutation } from "@/features/page/tree/hooks/use-tree-mutation.ts";
import { SpaceTreeNode } from "@/features/page/tree/types.ts";
import {
  getPageBreadcrumbs,
  getPageById,
} from "@/features/page/services/page-service.ts";
import { queryClient } from "@/main.tsx";
import {
  useClipboard,
  useDisclosure,
  useElementSize,
  useMergedRef,
} from "@mantine/hooks";
import { useQueryEmit } from "@/features/websocket/use-query-emit.ts";
import { buildPageUrl } from "@/features/page/page.utils.ts";
import { notifications } from "@mantine/notifications";
import { getAppUrl } from "@/lib/config.ts";
import { extractPageSlugId } from "@/lib";
import { useDeletePageModal } from "@/features/page/hooks/use-delete-page-modal.tsx";
import { useTranslation } from "react-i18next";
import ExportModal from "@/components/common/export-modal";
import MovePageModal from "../../components/move-page-modal.tsx";
import { mobileSidebarAtom } from "@/components/layouts/global/hooks/atoms/sidebar-atom.ts";
import { useToggleSidebar } from "@/components/layouts/global/hooks/hooks/use-toggle-sidebar.ts";
import CopyPageModal from "../../components/copy-page-modal.tsx";
import { duplicatePage } from "../../services/page-service.ts";
import { useTree as useHeadlessTree } from "@headless-tree/react/react17"
import { asyncDataLoaderFeature, createOnDropHandler, dragAndDropFeature, hotkeysCoreFeature, selectionFeature, type FeatureImplementation, type ItemInstance } from "@headless-tree/core";
import { t } from "i18next";
import { treeDataAtom } from "../atoms/tree-data-atom.ts";

interface SpaceTreeProps {
  spaceId: string;
  readOnly: boolean;
}

declare module "@headless-tree/core" {
  export interface TreeConfig<T> {
    activeItemId?: string;
  }
  export interface ItemInstance<T> {
    isActive: () => boolean;
  }
}
const headlessTreeExtensions: FeatureImplementation<SpaceTreeNode> = {
  itemInstance: {
    isActive: ({itemId, tree}) => tree.getConfig().activeItemId === itemId,
  },
};

export default function SpaceTree({ spaceId, readOnly }: SpaceTreeProps) {
  const { pageSlug } = useParams();
  const [, setTree] = useAtom(treeDataAtom);
  const treeMutations = useTreeMutation<SpaceTreeNode>(spaceId);
  const { data: currentPage } = usePageQuery({
    pageId: extractPageSlugId(pageSlug),
  });

  const tree = useHeadlessTree<SpaceTreeNode>({
     rootItemId: "root",
     activeItemId: currentPage?.id,
     getItemName: item => item.getItemData()?.name ?? t("untitled"),
     createLoadingItemData: () => ({
       id: "loading",
       name: "Loading...",
       position: null,
       spaceId: spaceId,
       parentPageId: null,
       hasChildren: false,
       slugId: "",
       children: [],
     }),
     isItemFolder: item => item.getChildren().length > 0,
     canDrop: () => true,
     onDrop: treeMutations.move,
     dataLoader: {
       getItem: async pageId => {
         return null as any;
       },
       getChildrenWithData: async pageId => {
         const children = await fetchAllAncestorChildren({
           spaceId,
           pageId: pageId === "root" ? null : pageId,
         });
         return (children).map(data => ({
           id: data.id,
           data,
         }));
       }
     },
     indent: 20,
     features: [
       asyncDataLoaderFeature, 
       selectionFeature, 
       hotkeysCoreFeature, 
       dragAndDropFeature,
       headlessTreeExtensions
     ]
  });

  useEffect(() => {
    // @ts-ignore
    setTree({ tree });
  }, [tree, setTree]);

  useEffect(() => {
    (async () => {
      if (!currentPage?.id) return;
      const breadcrumbs = await getPageBreadcrumbs(currentPage.id);
      await Promise.all(breadcrumbs.map(breadcrumb => tree.loadChildrenIds(breadcrumb.parentPageId)));
      breadcrumbs.forEach(breadcrumb => tree.getItemInstance(breadcrumb.id).expand());

      // @ts-ignore
      setTree({ tree }); // trigger rerender of breadcrumbs
    })();
  }, [currentPage?.id]);

  return (
    <div {...tree.getContainerProps()} className="tree">
      {tree.getItems().map((item) => (
        <Node
          key={item.getId()}
          item={item}
          spaceId={spaceId}
        />
      ))}
      <div style={tree.getDragLineStyle()} className={classes.dragline} />
    </div>
  );
}

function Node({ item, spaceId, preview, disableEdit }: {
  item: ItemInstance<SpaceTreeNode>;
  spaceId: string;
  preview?: boolean;
  disableEdit?: boolean;
}) {
  const { t } = useTranslation();
  const updatePageMutation = useUpdatePageMutation();
  const emit = useQueryEmit();
  const { spaceSlug } = useParams();
  const timerRef = useRef(null);
  const [mobileSidebarOpened] = useAtom(mobileSidebarAtom);
  const toggleMobileSidebar = useToggleSidebar(mobileSidebarAtom);

  const prefetchPage = () => {
    timerRef.current = setTimeout(() => {
      queryClient.prefetchQuery({
        queryKey: ["pages", item.getItemData().slugId],
        queryFn: () => getPageById({ pageId: item.getItemData().slugId }),
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

  const handleEmojiIconClick = (e: any) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleEmojiSelect = (emoji: { native: string }) => {
    updatePageMutation
      .mutateAsync({ pageId: item.getId(), icon: emoji.native })
      .then((data) => {
        setTimeout(() => {
          emit({
            operation: "updateOne",
            spaceId: item.getItemData().spaceId,
            entity: ["pages"],
            id: item.getId(),
            payload: { icon: emoji.native, parentPageId: data.parentPageId },
          });
        item.updateCachedData({
          ...item.getItemData(),
          icon: emoji.native,
        });
        }, 50);
      });
  };

  const handleRemoveEmoji = () => {
    updatePageMutation.mutateAsync({ pageId: item.getId(), icon: null });

    setTimeout(() => {
      emit({
        operation: "updateOne",
        spaceId: item.getItemData().spaceId,
        entity: ["pages"],
        id: item.getId(),
        payload: { icon: null },
      });
      item.updateCachedData({
        ...item.getItemData(),
        icon: null,
      });
    }, 50);
  };

  if (!item.getItemData()) {
    console.warn("Item data is missing for item:", item.getId());
  }
  const pageUrl = buildPageUrl(spaceSlug, item.getItemData()?.slugId, item.getItemName());

  return (
    <>
      <Box
        {...item.getProps()}
        style={{ paddingLeft: `${item.getItemMeta().level * 20}px` }}
        className={clsx(
          classes.node, 
          item.isActive() && classes.isSelected, 
          item.isFocused() && classes.isFocused,
          item.isDragTarget() && classes.willReceiveDrop,
        )}
        component={Link}
        to={pageUrl}
        onClick={() => {
          if (mobileSidebarOpened) {
            toggleMobileSidebar();
          }
        }}
        onMouseEnter={prefetchPage}
        onMouseLeave={cancelPagePrefetch}
      >
       <PageArrow item={item} />

        <div onClick={handleEmojiIconClick} style={{ marginRight: "4px" }}>
          <EmojiPicker
            onEmojiSelect={handleEmojiSelect}
            icon={
              item.getItemData().icon ? (
                item.getItemData().icon
              ) : (
                <IconFileDescription size="18" />
              )
            }
            readOnly={disableEdit}
            removeEmojiAction={handleRemoveEmoji}
          />
        </div>

        <span className={classes.text}>{item.getItemName()}</span>

        <div className={classes.actions}>
          <TreeItemMenu item={item} spaceId={item.getItemData().spaceId} disableEdit={disableEdit} />

          {!disableEdit && (
            <CreateNode
              item={item}
              spaceId={spaceId}
            />
          )}
        </div>
      </Box>
    </>
  );
}

interface CreateNodeProps {
  spaceId: string;
  item: ItemInstance<SpaceTreeNode>;
}

function CreateNode({ item, spaceId }: CreateNodeProps) {
  const treeMutations = useTreeMutation<SpaceTreeNode>(spaceId);
  async function handleCreate() {
    await treeMutations.create(item);
    item.expand();
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

interface TreeItemMenuProps {
  item: ItemInstance<SpaceTreeNode>;
  spaceId: string;
  disableEdit?: boolean;
}

function TreeItemMenu({ item, spaceId, disableEdit }: TreeItemMenuProps) {
  const mutations = useTreeMutation(spaceId)
  const { t } = useTranslation();
  const clipboard = useClipboard({ timeout: 500 });
  const { spaceSlug } = useParams();
  const { openDeleteModal } = useDeletePageModal();
  const emit = useQueryEmit();
  const [exportOpened, { open: openExportModal, close: closeExportModal }] =
    useDisclosure(false);
  const [
    movePageModalOpened,
    { open: openMovePageModal, close: closeMoveSpaceModal },
  ] = useDisclosure(false);
  const [
    copyPageModalOpened,
    { open: openCopyPageModal, close: closeCopySpaceModal },
  ] = useDisclosure(false);

  const handleCopyLink = () => {
    const pageUrl =
      getAppUrl() + buildPageUrl(spaceSlug, item.getItemData().slugId, item.getItemName());
    clipboard.copy(pageUrl);
    notifications.show({ message: t("Link copied") });
  };

  const handleDuplicatePage = async () => {
    try {
      const duplicatedPage = await duplicatePage({
        pageId: item.getId(),
      });

      const { index, parentId } = item.getItemMeta();
      const newIndex = index + 1;

      // Add the duplicated page to the tree
      const treeNodeData: SpaceTreeNode = {
        id: duplicatedPage.id,
        slugId: duplicatedPage.slugId,
        name: duplicatedPage.title,
        position: duplicatedPage.position,
        spaceId: duplicatedPage.spaceId,
        parentPageId: duplicatedPage.parentPageId,
        icon: duplicatedPage.icon,
        hasChildren: duplicatedPage.hasChildren,
        children: [],
      };

      // Update local tree
      await item.getTree().getRootItem().invalidateChildrenIds();

      // Emit socket event
      setTimeout(() => {
        emit({
          operation: "addTreeNode",
          spaceId: spaceId,
          payload: {
            parentId,
            index: newIndex,
            data: treeNodeData,
          },
        });
      }, 50);

      notifications.show({
        message: t("Page duplicated successfully"),
      });
    } catch (err) {
      notifications.show({
        message: err.response?.data.message || "An error occurred",
        color: "red",
      });
    }
  };

  return (
    <>
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
            leftSection={<IconLink size={16} />}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleCopyLink();
            }}
          >
            {t("Copy link")}
          </Menu.Item>

          <Menu.Item
            leftSection={<IconFileExport size={16} />}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              openExportModal();
            }}
          >
            {t("Export page")}
          </Menu.Item>
          {!disableEdit && (
            <>
              <Menu.Item
                leftSection={<IconCopy size={16} />}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleDuplicatePage();
                }}
              >
                {t("Duplicate")}
              </Menu.Item>

              <Menu.Item
                leftSection={<IconArrowRight size={16} />}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  openMovePageModal();
                }}
              >
                {t("Move")}
              </Menu.Item>

              <Menu.Item
                leftSection={<IconCopy size={16} />}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  openCopyPageModal();
                }}
              >
                {t("Copy to space")}
              </Menu.Item>

              <Menu.Divider />
              <Menu.Item
                c="red"
                leftSection={<IconTrash size={16} />}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  openDeleteModal({ onConfirm: () => mutations.delete(item) });
                }}
              >
                {t("Delete")}
              </Menu.Item>
            </>
          )}
        </Menu.Dropdown>
      </Menu>

      <MovePageModal
        pageId={item.getId()}
        slugId={item.getItemData().slugId}
        currentSpaceSlug={spaceSlug}
        onClose={closeMoveSpaceModal}
        open={movePageModalOpened}
      />

      <CopyPageModal
        pageId={item.getId()}
        currentSpaceSlug={spaceSlug}
        onClose={closeCopySpaceModal}
        open={copyPageModalOpened}
      />

      <ExportModal
        type="page"
        id={item.getId()}
        open={exportOpened}
        onClose={closeExportModal}
      />
    </>
  );
}

interface PageArrowProps {
  item: ItemInstance<SpaceTreeNode>;
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
      onClick={() => {
        if (!isFolder) return;
        if (item.isExpanded()) {
          item.collapse();
        } else {
          item.expand();
        }
      }}
    >
      {
        isFolder ? (
          item.isExpanded() ? (
            <IconChevronDown stroke={2} size={18} />
          ) : (
            <IconChevronRight stroke={2} size={18} />
          )
        ) : (
          <IconPointFilled size={8} />
        )
      }
    </ActionIcon>
  );
}
