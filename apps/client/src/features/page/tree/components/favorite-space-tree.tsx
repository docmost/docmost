import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { atom, useAtom } from "jotai";
import { Group, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { generateJitteredKeyBetween } from "fractional-indexing-jittered";

import {
  useFavoritesQuery,
  useMoveFavoriteMutation,
} from "@/features/favorite/queries/favorite-query";
import {
  fetchAllAncestorChildren,
  usePageQuery,
} from "@/features/page/queries/page-query";
import { SpaceTreeNode } from "@/features/page/tree/types";
import { extractPageSlugId } from "@/lib";
import { getPageTitle } from "@/features/page/page.utils";
import { useTreeMutation } from "@/features/page/tree/hooks/use-tree-mutation";
import { treeModel, pathKey } from "@/features/page/tree/model/tree-model";
import type { DropOp } from "@/features/page/tree/model/tree-model.types";
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
  const { handleMove: pageHandleMove } = useTreeMutation(
    spaceId,
    favTreeDataAtom,
  );
  const moveFavoriteMutation = useMoveFavoriteMutation();
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
            position: f.position,
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

  // Root shortcuts can be dragged to manually reorder the favorites list.
  // Real descendants (revealed by expanding a starred page) behave like the
  // main tree — draggable only if the user can edit that page.
  const disableDragDrop = useCallback(
    (n: SpaceTreeNode) => n.parentPageId !== null && n.canEdit === false,
    [],
  );

  // Root shortcuts and real descendants are separate domains that must never
  // intermix via drag: dropping a real page onto a root row (or vice versa)
  // doesn't correspond to any sensible operation here, and — since a root
  // row's id is a real page id — could otherwise silently trigger an actual
  // page move instead of a favorites reorder.
  const canDropInto = useCallback(
    (source: SpaceTreeNode, target: SpaceTreeNode) =>
      (source.parentPageId === null) === (target.parentPageId === null),
    [],
  );

  // Root shortcuts only support reordering among themselves — nesting one
  // favorite under another isn't a concept this flat list has.
  const disallowDropKind = useCallback(
    (n: SpaceTreeNode, kind: DropOp["kind"]) =>
      n.parentPageId === null && kind === "make-child",
    [],
  );

  // Real descendants move like the main tree (an actual page move). Root
  // shortcuts only reorder this user's manual favorites order — the
  // underlying page's real position/parent is never touched.
  const handleMove = useCallback(
    async (sourceId: string, op: DropOp) => {
      const sourceNode = treeModel.find(data, sourceId) as SpaceTreeNode | null;
      if (!sourceNode) return;

      if (sourceNode.parentPageId !== null) {
        await pageHandleMove(sourceId, op);
        return;
      }

      // `data`'s top-level entries are always root shortcuts — any real
      // descendants live nested in `.children` — so this only ever reorders
      // root favorites.
      const before = data;
      const withoutSource = data.filter((n) => n.id !== sourceId);
      const targetIndex = withoutSource.findIndex((n) => n.id === op.targetId);
      if (targetIndex === -1) return;
      const insertAt =
        op.kind === "reorder-after" ? targetIndex + 1 : targetIndex;

      const prevPosition = withoutSource[insertAt - 1]?.position ?? null;
      const nextPosition = withoutSource[insertAt]?.position ?? null;
      const position = generateJitteredKeyBetween(prevPosition, nextPosition);

      setData([
        ...withoutSource.slice(0, insertAt),
        { ...sourceNode, position },
        ...withoutSource.slice(insertAt),
      ]);

      try {
        await moveFavoriteMutation.mutateAsync({ pageId: sourceId, position });
      } catch {
        setData(before);
        notifications.show({
          message: t("Failed to move favorite"),
          color: "red",
        });
      }
    },
    [data, pageHandleMove, moveFavoriteMutation, setData, t],
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
          canDropInto={canDropInto}
          disallowDropKind={disallowDropKind}
          getDragLabel={getDragLabel}
          aria-label={t("Starred")}
        />
      </div>
    </div>
  );
}
