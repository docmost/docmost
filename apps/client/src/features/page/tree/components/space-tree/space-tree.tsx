import { Tree, TreeApi } from "react-arborist";
import { useAtom } from "jotai";
import { treeApiAtom } from "@/features/page/tree/atoms/tree-api-atom.ts";
import {
  fetchAncestorChildren,
  useGetRootSidebarPagesQuery,
  usePageQuery,
} from "@/features/page/queries/page-query.ts";
import { useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import classes from "@/features/page/tree/styles/tree.module.css";
import { useTreeMutation } from "@/features/page/tree/hooks/use-tree-mutation.ts";
import {
  appendNodeChildren,
  buildTree,
  buildTreeWithChildren,
} from "@/features/page/tree/utils/utils.ts";
import { SpaceTreeNode } from "@/features/page/tree/types.ts";
import { getPageBreadcrumbs } from "@/features/page/services/page-service.ts";
import { IPage } from "@/features/page/types/page.types.ts";
import { queryClient } from "@/main.tsx";
import { OpenMap } from "react-arborist/dist/main/state/open-slice";
import { useElementSize, useMergedRef } from "@mantine/hooks";
import { dfs } from "react-arborist/dist/module/utils";
import { extractPageSlugId } from "@/lib";
import { reloadTreeAtom } from "@/features/page/atoms/reload-tree-atom.ts";
import { openTreeNodesAtom } from "@/features/page/tree/atoms/open-tree-nodes-atom.ts";
import { Node } from "./space-tree-node.tsx";

interface SpaceTreeProps {
  spaceId: string;
  readOnly: boolean;
}

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
  const [reloadTree] = useAtom(reloadTreeAtom);
  const treeApiRef = useRef<TreeApi<SpaceTreeNode>>();
  const [openTreeNodes, setOpenTreeNodes] = useAtom<OpenMap>(openTreeNodesAtom);
  const rootElement = useRef<HTMLDivElement>();
  const { ref: sizeRef, width } = useElementSize();
  const mergedRef = useMergedRef(rootElement, sizeRef);
  const isDataLoaded = useRef(false);
  const { data: currentPage } = usePageQuery({
    pageId: extractPageSlugId(pageSlug),
  });

  useEffect(() => {
    if (hasNextPage && !isFetching) {
      fetchNextPage();
    }
  }, [hasNextPage, fetchNextPage, isFetching, spaceId]);

  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ["root-sidebar-pages"] });
    setData([]);
    isDataLoaded.current = false;
  }, [reloadTree]);

  useEffect(() => {
    if (pagesData?.pages && !hasNextPage) {
      const allItems = pagesData.pages.flatMap((page) => page.items);
      const treeData = buildTree(allItems);

      if (data.length < 1 || data?.[0].spaceId !== spaceId) {
        //Thoughts
        // don't reset if there is data in state
        // we only expect to call this once on initial load
        // even if we decide to refetch, it should only update
        // and append root pages instead of resetting the entire tree
        // which looses async loaded children too
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
            const children = await fetchAncestorChildren({
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
          data={data.filter((node) => node?.spaceId === spaceId)}
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
