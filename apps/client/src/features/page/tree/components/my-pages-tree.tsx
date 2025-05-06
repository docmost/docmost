import { NodeApi, NodeRendererProps, Tree, TreeApi } from "react-arborist";
import { atom, useAtom } from "jotai";
import { treeApiAtom } from "@/features/page/tree/atoms/tree-api-atom.ts";
import {
  fetchAncestorChildren,
  useGetMyPagesQuery,
  usePageQuery,
  useUpdateMyPageColorMutation,
  useUpdatePageMutation,
} from "@/features/page/queries/page-query.ts";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import classes from "@/features/page/tree/styles/tree.module.css";
import {
  ActionIcon,
  Button,
  ColorPicker,
  Group,
  Menu,
  Modal,
  rem,
  Stack,
} from "@mantine/core";
import {
  IconChevronDown,
  IconChevronRight,
  IconColorPicker,
  IconDots,
  IconFileDescription,
  IconFileExport,
  IconPlus,
  IconTrash,
  IconUsers,
} from "@tabler/icons-react";
import { treeDataAtom } from "@/features/page/tree/atoms/tree-data-atom.ts";
import clsx from "clsx";
import EmojiPicker from "@/components/ui/emoji-picker.tsx";
import {
  appendNodeChildren,
  buildTree,
  buildTreeWithChildren,
  updateTreeNodeIcon,
} from "@/features/page/tree/utils/utils.ts";
import { SpaceTreeNode } from "@/features/page/tree/types.ts";
import {
  getMyPages,
  getPageBreadcrumbs,
  getPageById,
} from "@/features/page/services/page-service.ts";
import { IPage } from "@/features/page/types/page.types.ts";
import { queryClient } from "@/main.tsx";
import { OpenMap } from "react-arborist/dist/main/state/open-slice";
import { useDisclosure, useElementSize, useMergedRef } from "@mantine/hooks";
import { dfs } from "react-arborist/dist/module/utils";
import { useQueryEmit } from "@/features/websocket/use-query-emit.ts";
import { notifications } from "@mantine/notifications";
import { extractPageSlugId } from "@/lib";
import { useDeletePageModal } from "@/features/page/hooks/use-delete-page-modal.tsx";
import { useTranslation } from "react-i18next";
import ExportModal from "@/components/common/export-modal";
import PageShareModal from "../../components/share-modal";
import { colorAtom as pageColorsAtom } from "../atoms/tree-color-atom.ts";
import { personalSpaceIdAtom } from "../atoms/tree-current-space-atom.ts";
import { useMyPagesTreeMutation } from "@/features/my-pages/tree/hooks/use-tree-mutation.ts";

interface MyPagesTreeProps {
  spaceId: string;
  readOnly: boolean;
}

const openTreeNodesAtom = atom<OpenMap>({});

export default function MyPagesTree({ spaceId, readOnly }: MyPagesTreeProps) {
  const { pageSlug } = useParams();

  const { data, setData, controllers } =
    useMyPagesTreeMutation<TreeApi<SpaceTreeNode>>(spaceId);
  const {
    data: pagesData,
    hasNextPage,
    fetchNextPage,
    isFetching,
  } = useGetMyPagesQuery();
  const { data: currentPage } = usePageQuery({
    pageId: extractPageSlugId(pageSlug),
  });

  const [, setTreeApi] = useAtom<TreeApi<SpaceTreeNode>>(treeApiAtom);
  const [openTreeNodes, setOpenTreeNodes] = useAtom<OpenMap>(openTreeNodesAtom);

  const treeApiRef = useRef<TreeApi<SpaceTreeNode>>();
  const rootElement = useRef<HTMLDivElement>();
  const { ref: sizeRef, width, height } = useElementSize();
  const mergedRef = useMergedRef(rootElement, sizeRef);
  const isDataLoaded = useRef(false);

  const [, setPersonalSpaceId] = useAtom<string>(personalSpaceIdAtom);

  const [, setPageColors] = useAtom(pageColorsAtom);

  const loadColors = (pages: any[]) => {
    const colors = ["#4CAF50", "#2196F3", "#9C27B0", "#FF9800", "#E91E63"];
    const loadedColors = pages.reduce(
      (acc, page) => ({
        ...acc,
        [page.id]:
          page.color ?? colors[Math.floor(Math.random() * colors.length)],
      }),
      {},
    );
    setPageColors((prev) => ({ ...prev, ...loadedColors }));
  };

  useEffect(() => {
    setPersonalSpaceId(spaceId);
  }, [spaceId]);

  useEffect(() => {
    if (hasNextPage && !isFetching) {
      fetchNextPage();
    }
  }, [hasNextPage, fetchNextPage, isFetching, spaceId]);

  useEffect(() => {
    if (pagesData?.pages && !hasNextPage) {
      const allItems = pagesData.pages.flatMap((page) => page.items);
      const treeData = buildTree(allItems);

      loadColors(allItems);

      if (data.length < 1 || data?.[0].spaceId !== spaceId) {
        setData(treeData);
        isDataLoaded.current = true;
        setOpenTreeNodes({});
      }
    }
  }, [pagesData, hasNextPage]);

  useEffect(() => {
    const fetchData = async () => {
      if (isDataLoaded.current && currentPage) {
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

            const pages = await getMyPages(ancestor.id);
            const children = buildTree(pages.items);

            loadColors(pages.items);

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
  }, [isDataLoaded.current, currentPage?.id]);

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

  useEffect(() => {
    if (treeApiRef.current) {
      // @ts-ignore
      setTreeApi(treeApiRef.current);
    }
  }, [treeApiRef.current]);

  return (
    <div ref={mergedRef} className={classes.treeContainer}>
      {rootElement.current && (
        <Tree
          data={data}
          disableDrag={readOnly}
          disableDrop={readOnly}
          disableEdit={readOnly}
          {...controllers}
          width={width}
          height={rootElement.current.clientHeight}
          ref={treeApiRef}
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
  const navigate = useNavigate();

  const updatePageMutation = useUpdatePageMutation();

  const [treeData, setTreeData] = useAtom(treeDataAtom);
  const [personalSpaceId] = useAtom(personalSpaceIdAtom);
  const [nodeColors] = useAtom(pageColorsAtom);
  const [nodeColor, setColor] = useState<string>(
    nodeColors[node.data.id] || "#4CAF50",
  );

  const emit = useQueryEmit();
  const timerRef = useRef(null);

  const isPersonalSpace = node.data.spaceId === personalSpaceId;

  useEffect(() => {
    // Assign the color based on the parent page ID or the node ID?
    // if (node.data.parentPageId) {
    //   setColor(nodeColors[node.data.parentPageId] || "#4CAF50");
    // } else {
    //   setColor(nodeColors[node.data.id] || "#4CAF50");
    // }

    setColor(nodeColors[node.data.id] || "#4CAF50");
  }, [nodeColors, node.data.id]);

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
            className={classes.syncIndicator}
            style={{ backgroundColor: nodeColor }}
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
        <div className={classes.actions}>
          {!tree.props.disableEdit && (
            <CreateNode
              node={node}
              treeApi={tree}
              onExpandTree={() => handleLoadChildren(node)}
            />
          )}
          <NodeMenu
            node={node}
            treeApi={tree}
            isPersonalSpace={isPersonalSpace}
          />
        </div>
      </div>
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
  isPersonalSpace: boolean;
}

function NodeMenu({ node, treeApi, isPersonalSpace }: NodeMenuProps) {
  const { t } = useTranslation();
  const { openDeleteModal } = useDeletePageModal();
  const updateMyPageColorMutation = useUpdateMyPageColorMutation();

  const [pageColors, setPageColors] = useAtom(pageColorsAtom);

  const [color, setColor] = useState(pageColors[node.data.id]);

  const [exportOpened, { open: openExportModal, close: closeExportModal }] =
    useDisclosure(false);
  const [shareOpened, { open: openShareModal, close: closeShareModal }] =
    useDisclosure(false);
  const [
    colorPickerOpened,
    { open: openColorPicker, close: closeColorPicker },
  ] = useDisclosure(false);

  const handleColorChange = (newColor: string) => {
    setColor(newColor);
  };

  const applyNewColor = () => {
    updateMyPageColorMutation
      .mutateAsync({ pageId: node.data.id, color: color })
      .then(() => {
        setPageColors((prev) => ({
          ...prev,
          [node.data.id]: color,
        }));
        notifications.show({ message: t("Color updated") });
      })
      .catch(() => {
        notifications.show({
          message: t("Failed to update color"),
          color: "red",
        });
      });

    closeColorPicker();
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
            <IconDots style={{ width: rem(20), height: rem(20) }} stroke={2} />
          </ActionIcon>
        </Menu.Target>

        <Menu.Dropdown>
          <Menu.Item
            leftSection={<IconColorPicker size={16} />}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              openColorPicker();
            }}
          >
            {t("Change color")}
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

          {isPersonalSpace && (
            <div>
              <Menu.Item
                leftSection={<IconUsers size={16} />}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  openShareModal();
                }}
              >
                {t("Share")}
              </Menu.Item>

              <Menu.Divider />
              <Menu.Item
                c="red"
                leftSection={<IconTrash size={16} />}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  openDeleteModal({
                    onConfirm: () => treeApi?.delete(node),
                  });
                }}
              >
                {t("Delete")}
              </Menu.Item>
            </div>
          )}
        </Menu.Dropdown>
      </Menu>

      <Modal
        opened={colorPickerOpened}
        onClose={closeColorPicker}
        title={t("Choose a color")}
        size="sm"
      >
        <Stack>
          <ColorPicker
            format="hex"
            value={color}
            onChange={handleColorChange}
            swatches={[
              "#25262b",
              "#868e96",
              "#fa5252",
              "#e64980",
              "#be4bdb",
              "#7950f2",
              "#4c6ef5",
              "#228be6",
              "#15aabf",
              "#12b886",
              "#40c057",
              "#82c91e",
              "#fab005",
              "#fd7e14",
            ]}
          />
          <Group justify="flex-end" mt="md">
            <Button variant="outline" onClick={closeColorPicker}>
              {t("Cancel")}
            </Button>
            <Button onClick={() => applyNewColor()}>{t("Apply")}</Button>
          </Group>
        </Stack>
      </Modal>

      <ExportModal
        type="page"
        id={node.id}
        open={exportOpened}
        onClose={closeExportModal}
      />

      <PageShareModal
        pageId={node.id}
        opened={shareOpened}
        onClose={closeShareModal}
      />
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
