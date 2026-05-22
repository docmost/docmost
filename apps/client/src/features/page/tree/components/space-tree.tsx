import { useAtom } from "jotai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Text } from "@mantine/core";
import {
  fetchAllAncestorChildren,
  useGetRootSidebarPagesQuery,
  usePageQuery,
} from "@/features/page/queries/page-query.ts";
import classes from "@/features/page/tree/styles/tree.module.css";
import { treeDataAtom } from "@/features/page/tree/atoms/tree-data-atom.ts";
import { openTreeNodesAtom } from "@/features/page/tree/atoms/open-tree-nodes-atom.ts";
import { useTreeMutation } from "@/features/page/tree/hooks/use-tree-mutation.ts";
import {
  buildTree,
  buildTreeWithChildren,
  mergeRootTrees,
} from "@/features/page/tree/utils/utils.ts";
import { SpaceTreeNode } from "@/features/page/tree/types.ts";
import { treeModel } from "@/features/page/tree/model/tree-model";
import { getPageBreadcrumbs } from "@/features/page/services/page-service.ts";
import { IPage } from "@/features/page/types/page.types.ts";
import { extractPageSlugId } from "@/lib";
import { DocTree } from "./doc-tree";
import { SpaceTreeRow } from "./space-tree-row";

interface SpaceTreeProps {
  spaceId: string;
  readOnly: boolean;
}

export default function SpaceTree({ spaceId, readOnly }: SpaceTreeProps) {
  const { t } = useTranslation();
  const { pageSlug } = useParams();
  const [data, setData] = useAtom(treeDataAtom);
  const { handleMove } = useTreeMutation(spaceId);
  const {
    data: pagesData,
    hasNextPage,
    fetchNextPage,
    isFetching,
  } = useGetRootSidebarPagesQuery({ spaceId });
  const [openTreeNodes, setOpenTreeNodes] = useAtom(openTreeNodesAtom);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const spaceIdRef = useRef(spaceId);
  spaceIdRef.current = spaceId;
  const { data: currentPage } = usePageQuery({
    pageId: extractPageSlugId(pageSlug),
  });

  useEffect(() => {
    setIsDataLoaded(false);
  }, [spaceId]);

  useEffect(() => {
    if (hasNextPage && !isFetching) {
      fetchNextPage();
    }
  }, [hasNextPage, fetchNextPage, isFetching, spaceId]);

  useEffect(() => {
    if (!pagesData?.pages || hasNextPage) return;

    const allItems = pagesData.pages.flatMap((page) => page.items);
    const treeData = buildTree(allItems);

    setData((prev) => {
      // Keep nodes belonging to other spaces — filteredData filters by spaceId
      // for rendering, so accumulating is safe. Preserves lazy-loaded children
      // and open-state when the user returns to a previously-visited space.
      const otherSpaces = prev.filter((n) => n?.spaceId !== spaceId);
      const currentSpace = prev.filter((n) => n?.spaceId === spaceId);
      const refreshed =
        currentSpace.length > 0
          ? mergeRootTrees(currentSpace, treeData)
          : treeData;
      return [...otherSpaces, ...refreshed];
    });
    setIsDataLoaded(true);
  }, [pagesData, hasNextPage, spaceId]);

  useEffect(() => {
    const effectSpaceId = spaceId;

    const fetchData = async () => {
      if (isDataLoaded && currentPage) {
        // check if pageId node is present in the tree
        const node = treeModel.find(data, currentPage.id);
        if (node) {
          // if node is found, no need to traverse its ancestors
          return;
        }

        // if not found, fetch and build its ancestors and their children
        if (!currentPage.id) return;
        const ancestors = await getPageBreadcrumbs(currentPage.id);

        if (spaceIdRef.current !== effectSpaceId) return;

        if (ancestors && ancestors.length > 1) {
          let flatTreeItems = [...buildTree(ancestors)];

          const fetchAndUpdateChildren = async (ancestor: IPage) => {
            // we don't want to fetch the children of the opened page
            if (ancestor.id === currentPage.id) return;
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

          Promise.all(fetchPromises).then(() => {
            if (spaceIdRef.current !== effectSpaceId) return;

            // build tree with children
            const ancestorsTree = buildTreeWithChildren(flatTreeItems);
            // child of root page we're attaching the built ancestors to
            const rootChild = ancestorsTree[0];

            // attach built ancestors to tree using functional updater
            setData((currentData) =>
              treeModel.appendChildren(
                currentData,
                rootChild.id,
                rootChild.children ?? [],
              ),
            );

            // open all ancestors of the current page. DocTree picks up the
            // selectedId change and scrolls the row into view on its own once
            // flat contains it.
            setOpenTreeNodes((prev) => {
              const next = { ...prev };
              for (const a of ancestors) {
                if (a.id !== currentPage.id) next[a.id] = true;
              }
              return next;
            });
          });
        }
      }
    };

    fetchData();
  }, [isDataLoaded, currentPage?.id]);

  const openIds = useMemo(
    () => new Set(Object.keys(openTreeNodes).filter((k) => openTreeNodes[k])),
    [openTreeNodes],
  );

  const handleToggle = useCallback(
    async (id: string, isOpen: boolean) => {
      setOpenTreeNodes((prev) => ({ ...prev, [id]: isOpen }));
      if (isOpen) {
        const node = treeModel.find(data, id) as SpaceTreeNode | null;
        if (
          node?.hasChildren &&
          (!node.children || node.children.length === 0)
        ) {
          const fetched = await fetchAllAncestorChildren({
            pageId: id,
            spaceId: node.spaceId,
          });
          setData((prev) => treeModel.appendChildren(prev, id, fetched));
        }
      }
    },
    [data, setOpenTreeNodes, setData],
  );

  const filteredData = useMemo(
    () => data.filter((node) => node?.spaceId === spaceId),
    [data, spaceId],
  );

  // Stable callbacks for DocTree. Without these, every parent render recreates
  // the props and tears down every row's draggable/dropTarget subscription,
  // defeating memo(DocTreeRow).
  const renderRow = useCallback(
    (rowProps: Parameters<typeof SpaceTreeRow>[0]) => (
      <SpaceTreeRow {...rowProps} readOnly={readOnly} />
    ),
    [readOnly],
  );
  const disableDragDrop = useCallback(
    (n: SpaceTreeNode) => n.canEdit === false,
    [],
  );
  const getDragLabel = useCallback(
    (n: SpaceTreeNode) => n.name || t("untitled"),
    [t],
  );

  return (
    <div className={classes.treeContainer}>
      {isDataLoaded && filteredData.length === 0 && (
        <Text size="xs" c="dimmed" py="xs" px="sm">
          {t("No pages yet")}
        </Text>
      )}
      {isDataLoaded && filteredData.length > 0 && (
        <DocTree<SpaceTreeNode>
          data={filteredData}
          openIds={openIds}
          selectedId={currentPage?.id}
          renderRow={renderRow}
          onMove={handleMove}
          onToggle={handleToggle}
          readOnly={readOnly}
          disableDrag={disableDragDrop}
          disableDrop={disableDragDrop}
          getDragLabel={getDragLabel}
          aria-label={t("Pages")}
        />
      )}
    </div>
  );
}
