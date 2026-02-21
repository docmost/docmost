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
import {
  ActionIcon,
  Box,
  Button,
  Group,
  Menu,
  Modal,
  Text,
  TextInput,
  rem,
} from "@mantine/core";
import {
  IconArrowRight,
  IconChevronDown,
  IconChevronRight,
  IconCopy,
  IconDotsVertical,
  IconFileText,
  IconFileExport,
  IconFolder,
  IconLink,
  IconPencil,
  IconPlus,
  IconPin,
  IconPinnedOff,
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
  updateTreeNodePinnedState,
  updateTreeNodeIcon,
} from "@/features/page/tree/utils/utils.ts";
import { SpaceTreeNode } from "@/features/page/tree/types.ts";
import {
  batchMovePages,
  pinPage,
  unpinPage,
  getPageBreadcrumbs,
  getPageById,
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
    if (!pagesData?.pages) {
      return;
    }

    const allItems = pagesData.pages.flatMap((page) => page.items);
    const treeData = buildTree(allItems);

    setData((prev) => {
      // fresh space; full reset
      if (prev.length === 0 || prev[0]?.spaceId !== spaceId) {
        setOpenTreeNodes({});
        return treeData;
      }

      // same space; append only missing roots
      return mergeRootTrees(prev, treeData);
    });

    if (!isDataLoaded) {
      setIsDataLoaded(true);
    }
  }, [pagesData, isDataLoaded, setData, setOpenTreeNodes, spaceId]);

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
          disableDrop={(args) => {
            if (readOnly) {
              return true;
            }

            const isRootTarget =
              args.parentNode.id === "__REACT_ARBORIST_INTERNAL_ROOT__";

            if (isRootTarget) {
              return args.dragNodes.some(
                (dragNode) => dragNode.data?.nodeType !== "folder",
              );
            }

            const parentNodeType =
              args.parentNode.data?.nodeType === "folder" ? "folder" : "file";

            if (parentNodeType === "folder") {
              return false;
            }

            return args.dragNodes.some(
              (dragNode) => dragNode.data?.nodeType === "folder",
            );
          }}
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
          disableMultiSelection={readOnly}
          className={classes.tree}
          rowClassName={classes.row}
          rowHeight={34}
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

  const buildSubmittedName = (value: string) => value.trim() || "untitled";

  if (node.isEditing) {
    return (
      <Box style={style} className={clsx(classes.node, node.state)}>
        <PageArrow node={node} onExpandTree={() => handleLoadChildren(node)} />

        <div onClick={handleEmojiIconClick} style={{ marginRight: "4px" }}>
          <EmojiPicker
            onEmojiSelect={handleEmojiSelect}
            icon={
              node.data.icon ? (
                node.data.icon
              ) : node.data.nodeType === "folder" ? (
                <IconFolder size={16} stroke={1.75} />
              ) : (
                <IconFileText size={16} stroke={1.75} />
              )
            }
            readOnly={tree.props.disableEdit as boolean}
            removeEmojiAction={handleRemoveEmoji}
          />
        </div>

        <TextInput
          size="xs"
          variant="unstyled"
          autoFocus
          defaultValue={node.data.name || ""}
          className={classes.text}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onBlur={(e) => {
            node.submit(buildSubmittedName(e.currentTarget.value));
          }}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") {
              e.preventDefault();
              node.submit(buildSubmittedName(e.currentTarget.value));
            }
            if (e.key === "Escape") {
              e.preventDefault();
              node.reset();
            }
          }}
        />
      </Box>
    );
  }

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
              ) : node.data.nodeType === "folder" ? (
                <IconFolder size={16} stroke={1.75} />
              ) : (
                <IconFileText size={16} stroke={1.75} />
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
  const isFolderNode = node.data.nodeType === "folder";

  function handleCreate(type: "leaf" | "internal") {
    if (node.data.hasChildren && node.children.length === 0) {
      node.toggle();
      onExpandTree();

      setTimeout(() => {
        treeApi?.create({ type, parentId: node.id, index: 0 });
      }, 500);
    } else {
      treeApi?.create({ type, parentId: node.id });
    }
  }

  if (!isFolderNode) {
    return (
      <ActionIcon
        variant="subtle"
        c="gray"
        size={20}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleCreate("leaf");
        }}
      >
        <IconPlus style={{ width: rem(16), height: rem(16) }} stroke={1.75} />
      </ActionIcon>
    );
  }

  return (
    <Menu shadow="md" width={180}>
      <Menu.Target>
        <ActionIcon
          variant="subtle"
          c="gray"
          size={20}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <IconPlus style={{ width: rem(16), height: rem(16) }} stroke={1.75} />
        </ActionIcon>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Item
          leftSection={<IconFileText size={16} stroke={1.75} />}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleCreate("leaf");
          }}
        >
          New file
        </Menu.Item>
        <Menu.Item
          leftSection={<IconFolder size={16} stroke={1.75} />}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleCreate("internal");
          }}
        >
          New folder
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
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
  const [filteredKeyword, setFilteredKeyword] = useState("");
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
  const [
    filteredMoveOpened,
    { open: openFilteredMoveModal, close: closeFilteredMoveModal },
  ] = useDisclosure(false);

  const isFolder = node.data.nodeType === "folder";
  const canEdit = !(treeApi.props.disableEdit as boolean);
  const selectedPageIds = Array.from(treeApi.selectedIds ?? []);
  const selectedMovableIds = selectedPageIds.filter((id) => id !== node.id);
  const canBatchMoveSelected =
    canEdit && isFolder && selectedMovableIds.length > 0;

  const refreshSidebarTree = () => {
    queryClient.removeQueries({
      predicate: (item) =>
        ["root-sidebar-pages", "sidebar-pages"].includes(
          item.queryKey[0] as string,
        ),
    });
    setData([]);
    treeApi.deselectAll();
  };

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
        nodeType: duplicatedPage.nodeType ?? node.data.nodeType ?? "file",
        isPinned: duplicatedPage.isPinned ?? false,
        pinnedAt: duplicatedPage.pinnedAt ?? null,
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

  const handleTogglePin = async () => {
    try {
      const result = node.data.isPinned
        ? await unpinPage(node.id)
        : await pinPage(node.id);
      const updatedTree = updateTreeNodePinnedState(
        data,
        node.id,
        result.isPinned,
        result.pinnedAt,
      );
      setData(updatedTree);
      notifications.show({
        message: result.isPinned ? "Pinned" : "Unpinned",
      });
    } catch (err) {
      notifications.show({
        message: err.response?.data.message || "Failed to update pin status",
        color: "red",
      });
    }
  };

  const handleBatchMoveSelectedHere = async () => {
    if (!canBatchMoveSelected) {
      return;
    }

    try {
      const result = await batchMovePages({
        spaceId,
        selectionMode: "ids",
        pageIds: selectedMovableIds,
        targetFolderId: node.id,
      });
      notifications.show({
        message:
          result.failedCount > 0
            ? `Moved ${result.movedCount}, failed ${result.failedCount}`
            : `Moved ${result.movedCount} pages`,
      });
      refreshSidebarTree();
    } catch (err) {
      notifications.show({
        message: err.response?.data.message || "Batch move failed",
        color: "red",
      });
    }
  };

  const handleBatchMoveFilteredHere = async () => {
    const keyword = filteredKeyword.trim();
    if (!keyword) {
      notifications.show({
        message: "Please enter a filter keyword",
        color: "yellow",
      });
      return;
    }

    try {
      const result = await batchMovePages({
        spaceId,
        selectionMode: "filtered",
        titleContains: keyword,
        targetFolderId: node.id,
      });
      notifications.show({
        message:
          result.failedCount > 0
            ? `Moved ${result.movedCount}, failed ${result.failedCount}`
            : `Moved ${result.movedCount} pages`,
      });
      closeFilteredMoveModal();
      setFilteredKeyword("");
      refreshSidebarTree();
    } catch (err) {
      notifications.show({
        message: err.response?.data.message || "Filtered batch move failed",
        color: "red",
      });
    }
  };

  return (
    <>
      <Menu shadow="md" width={200}>
        <Menu.Target>
          <ActionIcon
            variant="subtle"
            c="gray"
            size={20}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <IconDotsVertical
              style={{ width: rem(16), height: rem(16) }}
              stroke={1.75}
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
                leftSection={<IconPencil size={16} />}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  treeApi.edit(node.id);
                }}
              >
                Rename
              </Menu.Item>

              <Menu.Item
                leftSection={<IconFileText size={16} stroke={1.75} />}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  treeApi.create({ type: "leaf", parentId: node.id });
                }}
              >
                New file
              </Menu.Item>

              {isFolder && (
                <Menu.Item
                  leftSection={<IconFolder size={16} stroke={1.75} />}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    treeApi.create({ type: "internal", parentId: node.id });
                  }}
                >
                  New folder
                </Menu.Item>
              )}

              <Menu.Item
                leftSection={
                  node.data.isPinned ? (
                    <IconPinnedOff size={16} />
                  ) : (
                    <IconPin size={16} />
                  )
                }
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleTogglePin();
                }}
              >
                {node.data.isPinned ? "Unpin" : "Pin to top"}
              </Menu.Item>

              {isFolder && (
                <Menu.Item
                  leftSection={<IconArrowRight size={16} />}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    openFilteredMoveModal();
                  }}
                >
                  Move filtered pages here
                </Menu.Item>
              )}

              {canBatchMoveSelected && (
                <Menu.Item
                  leftSection={<IconArrowRight size={16} />}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleBatchMoveSelectedHere();
                  }}
                >
                  Move selected here ({selectedMovableIds.length})
                </Menu.Item>
              )}

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

      <Modal.Root
        opened={filteredMoveOpened}
        onClose={closeFilteredMoveModal}
        size={500}
        padding="xl"
        yOffset="10vh"
        xOffset={0}
        mah={400}
      >
        <Modal.Overlay blur={1} />
        <Modal.Content style={{ overflow: "hidden" }}>
          <Modal.Header py={0}>
            <Modal.Title fw={500}>Move filtered pages here</Modal.Title>
            <Modal.CloseButton />
          </Modal.Header>
          <Modal.Body>
            <Text mb="xs" c="dimmed" size="sm">
              Move all matched pages in this space to the selected folder.
            </Text>

            <TextInput
              label="Title contains"
              placeholder="e.g. PRD"
              value={filteredKeyword}
              onChange={(event) =>
                setFilteredKeyword(event.currentTarget.value)
              }
            />

            <Group justify="end" mt="md" gap="xs">
              <Button variant="subtle" onClick={closeFilteredMoveModal}>
                {t("Cancel")}
              </Button>
              <Button onClick={handleBatchMoveFilteredHere}>Move</Button>
            </Group>
          </Modal.Body>
        </Modal.Content>
      </Modal.Root>

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
      size={18}
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
            <IconChevronDown stroke={1.75} size={16} />
          ) : (
            <IconChevronRight stroke={1.75} size={16} />
          )
        ) : (
          <IconPointFilled size={8} />
        )
      ) : null}
    </ActionIcon>
  );
}
