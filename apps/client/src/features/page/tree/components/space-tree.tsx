import { useAtom } from "jotai";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation, useParams } from "react-router-dom";
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
  findPageInTree,
  mergeRootTrees,
  spaceRoots,
  updateSpaceRoots,
} from "@/features/page/tree/utils/utils.ts";
import { SpaceTreeNode } from "@/features/page/tree/types.ts";
import { getPageTitle } from "@/features/page/page.utils";
import { treeModel } from "@/features/page/tree/model/tree-model";
import { getPageBreadcrumbs } from "@/features/page/services/page-service.ts";
import { IPage } from "@/features/page/types/page.types.ts";
import { extractPageSlugId } from "@/lib";
import { DocTree, type RenderRowProps } from "./doc-tree";
import { SpaceTreeRow } from "./space-tree-row";

interface SpaceTreeProps {
  spaceId: string;
  readOnly: boolean;
}

export default function SpaceTree({ spaceId, readOnly }: SpaceTreeProps) {
  const { t } = useTranslation();
  const location = useLocation();
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
  const [pressedId, setPressedId] = useState<string>();
  const [pendingPage, setPendingPage] = useState<{
    id: string;
    pathname: string;
  }>();
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const spaceIdRef = useRef(spaceId);
  spaceIdRef.current = spaceId;
  const pageId = extractPageSlugId(pageSlug);
  const { data: currentPage } = usePageQuery({ pageId });

  useEffect(() => {
    if (!pressedId) return;
    const events = new AbortController();
    const options = { capture: true, signal: events.signal };
    const clear = () => setPressedId(undefined);
    const release = (event: PointerEvent) => {
      const target =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>("[data-row-id], button, [data-page-action]")
          : null;
      if (
        target?.dataset.rowId !== pressedId ||
        event.metaKey || event.ctrlKey || event.altKey || event.shiftKey
      ) clear();
    };
    window.addEventListener("pointerup", release, options);
    window.addEventListener("pointercancel", clear, options);
    window.addEventListener("dragstart", clear, options);
    window.addEventListener("click", clear, { signal: events.signal });
    window.addEventListener("blur", clear, { signal: events.signal });
    return () => events.abort();
  }, [pressedId]);

  const handlePageClick = useCallback((id: string, pathname: string) => {
    setPendingPage({ id, pathname });
    setPressedId(undefined);
  }, []);

  useLayoutEffect(() => {
    if (!pendingPage) return;
    // The browser URL changes on click. Keep the highlight until the router
    // catches up, or history moves away (Back can cancel an uncommitted route).
    const reconcile = () => {
      if (
        location.pathname === pendingPage.pathname ||
        window.location.pathname !== pendingPage.pathname
      ) setPendingPage(undefined);
    };
    reconcile();
    window.addEventListener("popstate", reconcile);
    return () => window.removeEventListener("popstate", reconcile);
  }, [location, pendingPage]);

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

    // Keep nodes belonging to other spaces — filteredData filters by spaceId
    // for rendering, so accumulating is safe. Preserves lazy-loaded children
    // and open-state when the user returns to a previously-visited space.
    setData((prev) =>
      updateSpaceRoots(prev, spaceId, (roots) =>
        roots.length > 0 ? mergeRootTrees(roots, treeData) : treeData,
      ),
    );
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
    () => spaceRoots(data, spaceId),
    [data, spaceId],
  );
  const selectedId = useMemo(
    () => currentPage?.id ?? findPageInTree(filteredData, pageId)?.id,
    [currentPage?.id, filteredData, pageId],
  );

  // Stable callbacks for DocTree. Without these, every parent render recreates
  // the props and tears down every row's draggable/dropTarget subscription,
  // defeating memo(DocTreeRow).
  const renderRow = useCallback(
    (rowProps: RenderRowProps<SpaceTreeNode>) => (
      <SpaceTreeRow
        {...rowProps}
        readOnly={readOnly}
        onPagePress={setPressedId}
        onPageClick={handlePageClick}
      />
    ),
    [readOnly, handlePageClick],
  );
  const disableDragDrop = useCallback(
    (n: SpaceTreeNode) => n.canEdit === false,
    [],
  );
  const getDragLabel = useCallback(
    (n: SpaceTreeNode) => getPageTitle(n.name, n.isBase, t),
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
          selectedId={selectedId}
          pendingSelectionId={pressedId ?? pendingPage?.id}
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
