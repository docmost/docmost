import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { atom, useAtom } from "jotai";
import { Group, Text } from "@mantine/core";

import { useFavoritesQuery } from "@/features/favorite/queries/favorite-query";
import {
  fetchAllAncestorChildren,
  usePageQuery,
} from "@/features/page/queries/page-query";
import { SpaceTreeNode } from "@/features/page/tree/types";
import { extractPageSlugId } from "@/lib";
import { getPageTitle } from "@/features/page/page.utils";
import { useTreeMutation } from "@/features/page/tree/hooks/use-tree-mutation";
import { treeModel, pathKey } from "@/features/page/tree/model/tree-model";
import { DocTree } from "@/features/page/tree/components/doc-tree";
import { SpaceTreeRow } from "@/features/page/tree/components/space-tree-row";
import treeClasses from "@/features/page/tree/styles/tree.module.css";

// Separate atom for favorite tree data — not shared with the main space tree
export const favTreeDataAtom = atom<SpaceTreeNode[]>([]);

const ROW_HEIGHT = 32;

interface FavoriteSpaceTreeProps {
  spaceId: string;
  sectionClassName?: string;
  headerClassName?: string;
  treeClassName?: string;
  readOnly?: boolean;
}

export function FavoriteSpaceTree({
  spaceId,
  sectionClassName,
  headerClassName,
  treeClassName,
  readOnly = false,
}: FavoriteSpaceTreeProps) {
  const { t } = useTranslation();
  const [data, setData] = useAtom(favTreeDataAtom);
  const { handleMove } = useTreeMutation(spaceId, favTreeDataAtom);
  const [openTreeNodes, setOpenTreeNodes] = useState<Record<string, boolean>>(
    {},
  );

  const { pageSlug } = useParams();
  const { data: currentPage } = usePageQuery({
    pageId: extractPageSlugId(pageSlug),
  });

  const {
    data: favoritesData,
    hasNextPage,
    fetchNextPage,
    isFetching,
  } = useFavoritesQuery("page", spaceId);

  // Exhaust pagination
  useEffect(() => {
    if (hasNextPage && !isFetching) fetchNextPage();
  }, [hasNextPage, isFetching, fetchNextPage]);

  // Build root nodes from favorites
  useEffect(() => {
    if (!hasNextPage && favoritesData?.pages) {
      const allFavorites = favoritesData.pages.flatMap((p) => p.items);
      setData(
        allFavorites
          .filter((f) => f.page)
          .map((f) => ({
            id: f.page.id,
            slugId: f.page.slugId,
            name: f.page.title,
            icon: f.page.icon,
            isBase: f.page.isBase,
            position: f.createdAt,
            spaceId: f.page.spaceId,
            parentPageId: null,
            hasChildren: true,
            canEdit: false,
            children: [],
          })),
      );
    }
  }, [favoritesData, hasNextPage, setData]);

  // Reset when switching spaces
  useEffect(() => {
    setData([]);
    setOpenTreeNodes({});
  }, [spaceId, setData]);

  const openIds = useMemo(
    () => new Set(Object.keys(openTreeNodes).filter((k) => openTreeNodes[k])),
    [openTreeNodes],
  );

  // A page can be independently starred even though it's also a descendant
  // of another starred page — it then legitimately appears twice in this
  // tree (once as its own root shortcut, once nested under its ancestor).
  // DocTree's keyByPath mode gives each occurrence its own open/select/focus
  // state (keyed by ancestor-id path, not the shared id), and the path-aware
  // treeModel helpers below target the exact occurrence that was toggled.
  const handleToggle = useCallback(
    async (
      id: string,
      isOpen: boolean,
      node: SpaceTreeNode,
      path: string[],
    ) => {
      setOpenTreeNodes((prev) => ({ ...prev, [pathKey(path)]: isOpen }));
      if (
        isOpen &&
        node.hasChildren &&
        (!node.children || node.children.length === 0)
      ) {
        const fetched = await fetchAllAncestorChildren({
          pageId: node.id,
          spaceId: node.spaceId,
        });
        setData((prev) => treeModel.appendChildrenByPath(prev, path, fetched));
      }
    },
    [setData],
  );

  // Root favourites are frozen: their order reflects when they were starred,
  // not a manually managed hierarchy, so they can't be dragged or targeted by
  // a drop. Sub-pages (parentPageId set) behave like the main SpaceTree.
  const disableDragDrop = useCallback(
    (n: SpaceTreeNode) => n.parentPageId === null || n.canEdit === false,
    [],
  );

  const getDragLabel = useCallback(
    (n: SpaceTreeNode) => getPageTitle(n.name, n.isBase, t),
    [t],
  );

  const renderRow = useCallback(
    (rowProps: Parameters<typeof SpaceTreeRow>[0]) => (
      <SpaceTreeRow
        {...rowProps}
        readOnly={readOnly}
        dataAtom={favTreeDataAtom}
        hideCreateButton
      />
    ),
    [readOnly],
  );

  if (!data.length) return null;

  const treeHeight = treeModel.visibleByPath(data, openIds).length * ROW_HEIGHT;

  return (
    <div className={sectionClassName}>
      <Group className={headerClassName} justify="space-between">
        <Text size="xs" fw={500} c="dimmed">
          {t("Starred")}
        </Text>
      </Group>

      <div className={treeClassName} style={{ height: treeHeight }}>
        <DocTree<SpaceTreeNode>
          keyByPath
          className={treeClasses.treeContainerNoScroll}
          data={data}
          openIds={openIds}
          selectedId={currentPage?.id}
          renderRow={renderRow}
          rowHeight={ROW_HEIGHT}
          onMove={handleMove}
          onToggle={handleToggle}
          readOnly={readOnly}
          disableDrag={disableDragDrop}
          disableDrop={disableDragDrop}
          getDragLabel={getDragLabel}
          aria-label={t("Starred")}
        />
      </div>
    </div>
  );
}
