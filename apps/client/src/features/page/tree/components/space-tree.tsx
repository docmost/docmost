import {
  NodeApi,
  NodeRendererProps,
  Tree,
  TreeApi,
  SimpleTree,
} from "react-arborist";
import { atom, useAtom } from "jotai";
import { treeApiAtom } from "@/features/page/tree/atoms/tree-api-atom.ts";
import {
  fetchAllAncestorChildren,
  useGetRootSidebarPagesQuery,
  usePageQuery,
  useUpdatePageMutation,
} from "@/features/page/queries/page-query.ts";
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
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
import {
  appendNodeChildrenAtom,
  treeDataAtom,
} from "@/features/page/tree/atoms/tree-data-atom.ts";
import clsx from "clsx";
import EmojiPicker from "@/components/ui/emoji-picker.tsx";
import { useTreeMutation } from "@/features/page/tree/hooks/use-tree-mutation.ts";
import {
  appendNodeChildren,
  buildTree,
  buildTreeWithChildren,
  mergeRootTrees,
  updateTreeNodeIcon,
} from "@/features/page/tree/utils/utils.ts";
import { SpaceTreeNode } from "@/features/page/tree/types.ts";
import {
  getPageBreadcrumbs,
  getPageById,
  getSidebarPages,
} from "@/features/page/services/page-service.ts";
import { IPage, SidebarPagesParams } from "@/features/page/types/page.types.ts";
import { queryClient } from "@/main.tsx";
import { OpenMap } from "react-arborist/dist/main/state/open-slice";
import {
  useClipboard,
  useDisclosure,
  useElementSize,
  useMergedRef,
} from "@mantine/hooks";
import { dfs } from "react-arborist/dist/module/utils";
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

interface SpaceTreeProps {
  spaceId: string;
  readOnly: boolean;
}

const openTreeNodesAtom = atom<OpenMap>({});

export default function SpaceTree({ spaceId, readOnly }: SpaceTreeProps) {
  const { pageSlug } = useParams();
  const { data, setData, controllers } =
    useTreeMutation<TreeApi<SpaceTreeNode>>(spaceId);
  const {
    data: pagesData,
    hasNextPage,
    fetchNextPage,
    isFetching,
  } = useGetRootSidebarPagesQuery({
    spaceId,
  });
  const [, setTreeApi] = useAtom<TreeApi<SpaceTreeNode>>(treeApiAtom);
  const treeApiRef = useRef<TreeApi<SpaceTreeNode>>();
  const [openTreeNodes, setOpenTreeNodes] = useAtom<OpenMap>(openTreeNodesAtom);
  const rootElement = useRef<HTMLDivElement>();
  const [isRootReady, setIsRootReady] = useState(false);
  const { ref: sizeRef, width, height } = useElementSize();
  const mergedRef = useMergedRef((element) => {
    rootElement.current = element;
    if (element && !isRootReady) {
      setIsRootReady(true);
    }
  }, sizeRef);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const { data: currentPage } = usePageQuery({
    pageId: extractPageSlugId(pageSlug),
  });

  useEffect(() => {
    if (hasNextPage && !isFetching) {
      fetchNextPage();
    }
  }, [hasNextPage, fetchNextPage, isFetching, spaceId]);

  useEffect(() => {
    if (pagesData?.pages && !hasNextPage) {
      const allItems = pagesData.pages.flatMap((page) => page.items);
      const treeData = buildTree(allItems);

      setData((prev) => {
        // fresh space; full reset
        if (prev.length === 0 || prev[0]?.spaceId !== spaceId) {
          setIsDataLoaded(true);
          setOpenTreeNodes({});
          return treeData;
        }

        // same space; append only missing roots
        return mergeRootTrees(prev, treeData);
      });
    }
  }, [pagesData, hasNextPage]);

  useEffect(() => {
    const fetchData = async () => {
      if (isDataLoaded && currentPage) {
        // check if pageId node is present in the tree
        const node = dfs(treeApiRef.current?.root, currentPage.id);
        if (node) {
          // if node is found, no need to traverse its ancestors
          return;
        }

        // if not found, fetch and build its ancestors and their children
        if (!currentPage.id) return;
        const ancestors = await getPageBreadcrumbs(currentPage.id);

        if (ancestors && ancestors?.length > 1) {
          let flatTreeItems = [...buildTree(ancestors)];

          const fetchAndUpdateChildren = async (ancestor: IPage) => {
            // we don't want to fetch the children of the opened page
            if (ancestor.id === currentPage.id) {
              return;
            }
            const children = await fetchAllAncestorChildren({
              pageId: ancestor.id,
              spaceId: ancestor.spaceId,
            });

            flatTreeItems = [
              ...flatTreeItems,
              ...children.filter(
                (child) => !flatTreeItems.some((item) => item.id === child.id),
              ),
            ];
          };

          const fetchPromises = ancestors.map((ancestor) =>
            fetchAndUpdateChildren(ancestor),
          );

          // Wait for all fetch operations to complete
          Promise.all(fetchPromises).then(() => {
            // build tree with children
            const ancestorsTree = buildTreeWithChildren(flatTreeItems);
            // child of root page we're attaching the built ancestors to
            const rootChild = ancestorsTree[0];

            // attach built ancestors to tree
            const updatedTree = appendNodeChildren(
              data,
              rootChild.id,
              rootChild.children,
            );
            setData(updatedTree);

            setTimeout(() => {
              // focus on node and open all parents
              treeApiRef.current.select(currentPage.id);
            }, 100);
          });
        }
      }
    };

    fetchData();
  }, [isDataLoaded, currentPage?.id]);

  useEffect(() => {
    if (currentPage?.id) {
      setTimeout(() => {
        // focus on node and open all parents
        treeApiRef.current?.select(currentPage.id, { align: "auto" });
      }, 200);
    } else {
      treeApiRef.current?.deselectAll();
    }
  }, [currentPage?.id]);

  // Clean up tree API on unmount
  useEffect(() => {
    return () => {
      // @ts-ignore
      setTreeApi(null);
    };
  }, [setTreeApi]);

  return (
    <div ref={mergedRef} className={classes.treeContainer}>
      {isRootReady && rootElement.current && (
        <Tree
          data={data.filter((node) => node?.spaceId === spaceId)}
          disableDrag={readOnly}
          disableDrop={readOnly}
          disableEdit={readOnly}
          {...controllers}
          width={width}
          height={rootElement.current.clientHeight}
          ref={(ref) => {
            treeApiRef.current = ref;
            if (ref) {
              //@ts-ignore
              setTreeApi(ref);
            }
          }}
          openByDefault={false}
          disableMultiSelection={true}
          className={classes.tree}
          rowClassName={classes.row}
          rowHeight={30}
          overscanCount={10}
          dndRootElement={rootElement.current}
          onToggle={() => {
            setOpenTreeNodes(treeApiRef.current?.openState);
          }}
          initialOpenState={openTreeNodes}
        >
          {Node}
        </Tree>
      )}
    </div>
  );
}

function Node({ node, style, dragHandle, tree }: NodeRendererProps<any>) {
  const { t } = useTranslation();
  const updatePageMutation = useUpdatePageMutation();
  const [treeData, setTreeData] = useAtom(treeDataAtom);
  const [, appendChildren] = useAtom(appendNodeChildrenAtom);
  const emit = useQueryEmit();
  const { spaceSlug } = useParams();
  const timerRef = useRef(null);
  const [mobileSidebarOpened] = useAtom(mobileSidebarAtom);
  const toggleMobileSidebar = useToggleSidebar(mobileSidebarAtom);

  const prefetchPage = () => {
    timerRef.current = setTimeout(async () => {
      const page = await queryClient.fetchQuery({
        queryKey: ["pages", node.data.id],
        queryFn: () => getPageById({ pageId: node.data.id }),
        staleTime: 5 * 60 * 1000,
      });
      if (page?.slugId) {
        queryClient.setQueryData(["pages", page.slugId], page);
      }
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
    // in conflict with use-query-subscription.ts => case "addTreeNode","moveTreeNode" etc with websocket
    // if (node.data.children && node.data.children.length > 0) {
    //   return;
    // }

    try {
      const params: SidebarPagesParams = {
        pageId: node.data.id,
        spaceId: node.data.spaceId,
      };

      const childrenTree = await fetchAllAncestorChildren(params);

      appendChildren({
        parentId: node.data.id,
        children: childrenTree,
      });
    } catch (error) {
      console.error("Failed to fetch children:", error);
    }
  }

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
    updatePageMutation
      .mutateAsync({ pageId: node.id, icon: emoji.native })
      .then((data) => {
        setTimeout(() => {
          emit({
            operation: "updateOne",
            spaceId: node.data.spaceId,
            entity: ["pages"],
            id: node.id,
            payload: { icon: emoji.native, parentPageId: data.parentPageId },
          });
        }, 50);
      });
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

  const pageUrl = buildPageUrl(spaceSlug, node.data.slugId, node.data.name);

  return (
    <>
      <Box
        style={style}
        className={clsx(classes.node, node.state)}
        component={Link}
        to={pageUrl}
        // @ts-ignore
        ref={dragHandle}
        onClick={() => {
          if (mobileSidebarOpened) {
            toggleMobileSidebar();
          }
        }}
        onMouseEnter={prefetchPage}
        onMouseLeave={cancelPagePrefetch}
      >
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

        <div className={classes.actions}>
          <NodeMenu node={node} treeApi={tree} spaceId={node.data.spaceId} />

          {!tree.props.disableEdit && (
            <CreateNode
              node={node}
              treeApi={tree}
              onExpandTree={() => handleLoadChildren(node)}
            />
          )}
        </div>
      </Box>
    </>
  );
}

interface CreateNodeProps {
  node: NodeApi<SpaceTreeNode>;
  treeApi: TreeApi<SpaceTreeNode>;
  onExpandTree?: () => void;
}

function CreateNode({ node, treeApi, onExpandTree }: CreateNodeProps) {
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

interface NodeMenuProps {
  node: NodeApi<SpaceTreeNode>;
  treeApi: TreeApi<SpaceTreeNode>;
  spaceId: string;
}

function NodeMenu({ node, treeApi, spaceId }: NodeMenuProps) {
  const { t } = useTranslation();
  const clipboard = useClipboard({ timeout: 500 });
  const { spaceSlug } = useParams();
  const { openDeleteModal } = useDeletePageModal();
  const [data, setData] = useAtom(treeDataAtom);
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
      getAppUrl() + buildPageUrl(spaceSlug, node.data.slugId, node.data.name);
    clipboard.copy(pageUrl);
    notifications.show({ message: t("Link copied") });
  };

  const handleDuplicatePage = async () => {
    try {
      const duplicatedPage = await duplicatePage({
        pageId: node.id,
      });

      // Find the index of the current node
      const parentId =
        node.parent?.id === "__REACT_ARBORIST_INTERNAL_ROOT__"
          ? null
          : node.parent?.id;
      const siblings = parentId ? node.parent.children : treeApi?.props.data;
      const currentIndex =
        siblings?.findIndex((sibling) => sibling.id === node.id) || 0;
      const newIndex = currentIndex + 1;

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
      const simpleTree = new SimpleTree(data);
      simpleTree.create({
        parentId,
        index: newIndex,
        data: treeNodeData,
      });
      setData(simpleTree.data);

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

          {!(treeApi.props.disableEdit as boolean) && (
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
                  openDeleteModal({ onConfirm: () => treeApi?.delete(node) });
                }}
              >
                {t("Move to trash")}
              </Menu.Item>
            </>
          )}
        </Menu.Dropdown>
      </Menu>

      <MovePageModal
        pageId={node.id}
        slugId={node.data.slugId}
        currentSpaceSlug={spaceSlug}
        onClose={closeMoveSpaceModal}
        open={movePageModalOpened}
      />

      <CopyPageModal
        pageId={node.id}
        currentSpaceSlug={spaceSlug}
        onClose={closeCopySpaceModal}
        open={copyPageModalOpened}
      />

      <ExportModal
        type="page"
        id={node.id}
        open={exportOpened}
        onClose={closeExportModal}
      />
    </>
  );
}

interface PageArrowProps {
  node: NodeApi<SpaceTreeNode>;
  onExpandTree?: () => void;
}

function PageArrow({ node, onExpandTree }: PageArrowProps) {
  useEffect(() => {
    if (node.isOpen) {
      onExpandTree();
    }
  }, []);

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
