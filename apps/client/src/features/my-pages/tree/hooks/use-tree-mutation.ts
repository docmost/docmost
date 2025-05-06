import { useMemo } from "react";
import {
  CreateHandler,
  DeleteHandler,
  MoveHandler,
  NodeApi,
  RenameHandler,
  SimpleTree,
} from "react-arborist";
import { useAtom } from "jotai";
import { treeDataAtom } from "@/features/page/tree/atoms/tree-data-atom.ts";
import { IMovePage, IPage } from "@/features/page/types/page.types.ts";
import { useNavigate, useParams } from "react-router-dom";
import {
  useCreatePageMutation,
  useDeletePageMutation,
  useMovePageMutation,
  useUpdatePageMutation,
} from "@/features/page/queries/page-query.ts";
import { generateJitteredKeyBetween } from "fractional-indexing-jittered";
import { SpaceTreeNode } from "@/features/page/tree/types.ts";
import { getSpaceUrl } from "@/lib/config.ts";
import { useQueryEmit } from "@/features/websocket/use-query-emit.ts";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";

export function useMyPagesTreeMutation<T>(spaceId: string) {
  const { t } = useTranslation();
  const [data, setData] = useAtom(treeDataAtom);
  const tree = useMemo(() => new SimpleTree<SpaceTreeNode>(data), [data]);
  const createPageMutation = useCreatePageMutation();
  const updatePageMutation = useUpdatePageMutation();
  const deletePageMutation = useDeletePageMutation();
  const movePageMutation = useMovePageMutation();
  const navigate = useNavigate();
  const { spaceSlug } = useParams();
  const { pageSlug } = useParams();
  const emit = useQueryEmit();

  const onCreate: CreateHandler<T> = async ({ parentId, index, type }) => {
    const payload: { spaceId: string; parentPageId?: string } = {
      spaceId: spaceId,
    };
    if (parentId) {
      payload.parentPageId = parentId;
    }

    let createdPage: IPage;
    try {
      createdPage = await createPageMutation.mutateAsync(payload);
    } catch (err) {
      throw new Error("Failed to create page");
    }

    const data = {
      id: createdPage.id,
      slugId: createdPage.slugId,
      name: "",
      position: createdPage.position,
      spaceId: createdPage.spaceId,
      parentPageId: createdPage.parentPageId,
      children: [],
      isSynced: false,
    } as any;

    let lastIndex: number;
    if (parentId === null) {
      lastIndex = tree.data.length;
    } else {
      lastIndex = tree.find(parentId).children.length;
    }
    // to place the newly created node at the bottom
    index = lastIndex;

    tree.create({ parentId, index, data });
    setData(tree.data);

    setTimeout(() => {
      emit({
        operation: "addTreeNode",
        spaceId: spaceId,
        payload: {
          parentId,
          index,
          data,
        },
      });
    }, 50);

    navigate(`/my-pages/${createdPage.id}`);

    return data;
  };

  const onMove: MoveHandler<T> = (args: {
    dragIds: string[];
    dragNodes: NodeApi<T>[];
    parentId: string | null;
    parentNode: NodeApi<T> | null;
    index: number;
  }) => {
    const draggedNodeId = args.dragIds[0];
    const originalTreeData = [...tree.data];
    const originalNode = tree.find(draggedNodeId);

    if (!originalNode) return;

    const originalParentId = originalNode.parent.id;
    const originalIndex = originalNode.childIndex;
    // @ts-ignore
    const originalPosition = args.dragNodes[0].data.position;

    const draggedNodeSpaceId = originalNode.data.spaceId;
    const draggedNodeHasParentPage = Boolean(originalNode.data.parentPageId);
    // @ts-ignore
    const targetSpaceId = args.parentNode?.data?.spaceId;

    const isMovingToAnotherSpace =
      draggedNodeSpaceId !== spaceId && draggedNodeHasParentPage;
    const isTargetInDifferentSpace =
      args.parentId && draggedNodeSpaceId !== targetSpaceId;
    const isTargetNotInCurrentSpace =
      args.parentId && spaceId !== targetSpaceId;

    if (isMovingToAnotherSpace || isTargetInDifferentSpace) {
      notifications.show({
        message: "You cannot move a page to a different space",
        color: "red",
      });
      return;
    }

    if (isTargetNotInCurrentSpace) {
      notifications.show({
        message: "You cannot move a page to a different space",
        color: "red",
      });
      return;
    }

    tree.move({
      id: draggedNodeId,
      parentId: args.parentId,
      index: args.index,
    });

    const newDragIndex = tree.find(draggedNodeId)?.childIndex;

    const currentTreeData = args.parentId
      ? tree.find(args.parentId).children
      : tree.data;

    // if there is a parentId, tree.find(args.parentId).children returns a SimpleNode array
    // we have to access the node differently via currentTreeData[args.index]?.data?.position
    // this makes it possible to correctly sort children of a parent node that is not the root

    const afterPosition =
      // @ts-ignore
      currentTreeData[newDragIndex - 1]?.position ||
      // @ts-ignore
      currentTreeData[args.index - 1]?.data?.position ||
      null;

    const beforePosition =
      // @ts-ignore
      currentTreeData[newDragIndex + 1]?.position ||
      // @ts-ignore
      currentTreeData[args.index + 1]?.data?.position ||
      null;

    let newPosition: string;

    if (afterPosition && beforePosition && afterPosition === beforePosition) {
      // if after is equal to before, put it next to the after node
      newPosition = generateJitteredKeyBetween(afterPosition, null);
    } else {
      // if both are null then, it is the first index
      newPosition = generateJitteredKeyBetween(afterPosition, beforePosition);
    }

    // update the node position in tree
    tree.update({
      id: draggedNodeId,
      changes: { position: newPosition } as any,
    });

    const previousParent = args.dragNodes[0].parent;
    if (
      previousParent.id !== args.parentId &&
      previousParent.id !== "__REACT_ARBORIST_INTERNAL_ROOT__"
    ) {
      // if the page was moved to another parent,
      // check if the previous still has children
      // if no children left, change 'hasChildren' to false, to make the page toggle arrows work properly
      const childrenCount = previousParent.children.filter(
        (child) => child.id !== draggedNodeId,
      ).length;
      if (childrenCount === 0) {
        tree.update({
          id: previousParent.id,
          changes: { ...previousParent.data, hasChildren: false } as any,
        });
      }
    }

    const payload: IMovePage = {
      pageId: draggedNodeId,
      position: newPosition,
      parentPageId: args.parentId,
      isMyPages: true,
      personalSpaceId: spaceId,
    };

    setData(tree.data);

    movePageMutation
      .mutateAsync(payload)
      .then(() => {
        notifications.show({
          message: t("Page moved successfully"),
          color: "green",
        });
      })
      .catch(() => {
        notifications.show({
          message: t("Failed to move a page"),
          color: "red",
        });
        setData(originalTreeData);

        tree.move({
          id: draggedNodeId,
          parentId: originalParentId,
          index: originalIndex,
        });
        tree.update({
          id: draggedNodeId,
          changes: { position: originalPosition } as any,
        });
      });

    setTimeout(() => {
      emit({
        operation: "moveTreeNode",
        spaceId: spaceId,
        payload: {
          id: draggedNodeId,
          parentId: args.parentId,
          index: args.index,
          position: newPosition,
        },
      });
    }, 50);
  };

  const onRename: RenameHandler<T> = ({ name, id }) => {
    tree.update({ id, changes: { name } as any });
    setData(tree.data);

    try {
      updatePageMutation.mutateAsync({ pageId: id, title: name });
    } catch (error) {
      console.error("Error updating page title:", error);
    }
  };

  const onDelete: DeleteHandler<T> = async (args: { ids: string[] }) => {
    try {
      await deletePageMutation.mutateAsync(args.ids[0]);

      const node = tree.find(args.ids[0]);
      if (!node) {
        return;
      }

      tree.drop({ id: args.ids[0] });
      setData(tree.data);

      // navigate only if the current url is same as the deleted page
      if (pageSlug && node.data.slugId === pageSlug.split("-")[1]) {
        navigate(getSpaceUrl(spaceSlug));
      }

      setTimeout(() => {
        emit({
          operation: "deleteTreeNode",
          spaceId: spaceId,
          payload: { node: node.data },
        });
      }, 50);
    } catch (error) {
      console.error("Failed to delete page:", error);
    }
  };

  const controllers = { onMove, onRename, onCreate, onDelete };
  return { data, setData, controllers } as const;
}
