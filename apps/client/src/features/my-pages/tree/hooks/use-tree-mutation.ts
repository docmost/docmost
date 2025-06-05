import { useMemo } from "react";
import {
  CreateHandler,
  DeleteHandler,
  NodeApi,
  RenameHandler,
  SimpleTree,
} from "react-arborist";
import { useAtom } from "jotai";
import { treeDataAtom } from "@/features/page/tree/atoms/tree-data-atom.ts";
import { IPage } from "@/features/page/types/page.types.ts";
import { useNavigate, useParams } from "react-router-dom";
import {
  useCopyPageMutation,
  useCreatePageMutation,
  useCreateSyncPageMutation,
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
import { onMoveActions } from "@/features/page/tree/components/move-or-copy-modal";
import { movePageToSpace } from "@/features/page/services/page-service";
import { usePageColors } from "@/features/page/tree/hooks/use-page-colors";

export function useMyPagesTreeMutation<T>(spaceId: string) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [data, setData] = useAtom(treeDataAtom);
  const tree = useMemo(() => new SimpleTree<SpaceTreeNode>(data), [data]);

  const createPageMutation = useCreatePageMutation();
  const updatePageMutation = useUpdatePageMutation();
  const deletePageMutation = useDeletePageMutation();
  const movePageMutation = useMovePageMutation();
  const copyPageMutation = useCopyPageMutation();
  const createSyncPageMutation = useCreateSyncPageMutation();

  const { spaceSlug } = useParams();
  const { pageSlug } = useParams();
  const emit = useQueryEmit();

  const { loadColors } = usePageColors();

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

  const onMove = async (
    {
      dragIds,
      dragNodes,
      parentId,
      parentNode,
      index,
    }: {
      dragIds: string[];
      dragNodes: NodeApi<SpaceTreeNode>[];
      parentId: string | null;
      parentNode: NodeApi<SpaceTreeNode> | null;
      index: number;
    },
    action?: onMoveActions,
  ) => {
    const originPageId = dragIds[0];
    const originNode = tree.find(originPageId);
    if (!originNode) return;

    const originalTreeData = [...tree.data];

    const targetSpaceId =
      parentNode?.data?.spaceId ??
      (originNode.data.parentPageId && originNode.data.parentPageId !== "ROOT"
        ? spaceId
        : originNode.data.spaceId);

    if (action === "copy" || action === "sync") {
      try {
        let created: IPage | null = null;

        if (action === "copy") {
          created = await copyPageMutation.mutateAsync({
            originPageId: originPageId,
            spaceId: targetSpaceId,
            parentPageId: parentId,
          });
        } else {
          created = await createSyncPageMutation.mutateAsync({
            originPageId: originPageId,
            spaceId: targetSpaceId,
            parentPageId: parentId,
          });
        }

        if (!created) {
          throw new Error("Failed to create a new page");
        }

        const newNodeData: SpaceTreeNode = {
          id: created.id,
          slugId: created.slugId ?? "",
          name: created.title ?? "",
          position: created.position,
          spaceId: created.spaceId,
          parentPageId: created.parentPageId,
          children: [],
          isSynced: action === "sync",
          hasChildren: false,
        };

        tree.create({ parentId, index, data: newNodeData });
        setData(tree.data);

        loadColors([
          {
            id: created.id,
            spaceId: created.spaceId,
            parentPageId: created.parentPageId,
          },
        ]);

        notifications.show({
          message: t("Page moved successfully"),
          color: "green",
        });

        setTimeout(() => {
          emit({
            operation: "addTreeNode",
            spaceId,
            payload: {
              parentId,
              index,
              data: newNodeData,
            },
          });
        }, 50);
      } catch (error) {
        notifications.show({
          message: t("Failed to move a page"),
          color: "red",
        });

        setData(originalTreeData);
      }
      return;
    }

    const originalParentId = originNode.parent.data.id;
    const originalIndex = originNode.childIndex;
    const originalPosition = dragNodes[0].data.position;

    moveNodeInTree(originPageId, parentId, index);

    const newPosition = calculateNewPosition(originPageId, parentId, index);
    updateNodePosition(originPageId, newPosition);
    maybeUpdateOldParent(dragNodes[0].parent, parentId, originPageId);

    setData(tree.data);

    try {
      await performBackendMove(
        action,
        originPageId,
        targetSpaceId,
        parentId,
        newPosition,
      );

      updateNodeSpaceAndParent(originPageId, targetSpaceId, parentId);
      loadColors([
        { id: originPageId, spaceId: targetSpaceId, parentPageId: parentId },
      ]);
      notifications.show({
        message: t("Page moved successfully"),
        color: "green",
      });
    } catch (error) {
      notifications.show({
        message: t("Failed to move a page"),
        color: "red",
      });

      setData(originalTreeData);
      tree.move({
        id: originPageId,
        parentId: originalParentId,
        index: originalIndex,
      });
      tree.update({
        id: originPageId,
        changes: { position: originalPosition } as any,
      });
    }

    setData(tree.data);

    emitMove(originPageId, parentId, index, newPosition);
  };

  function moveNodeInTree(id: string, parentId: string | null, index: number) {
    tree.move({ id, parentId, index });
  }

  function calculateNewPosition(
    id: string,
    parentId: string | null,
    index: number,
  ): string {
    const movedNode = tree.find(id);
    const newIndex = movedNode?.childIndex ?? index;
    const siblings = parentId ? tree.find(parentId).children : tree.data;

    const after =
      // @ts-ignore
      siblings[newIndex - 1]?.position ||
      // @ts-ignore
      siblings[index - 1]?.data?.position ||
      null;

    const before =
      // @ts-ignore
      siblings[newIndex + 1]?.position ||
      // @ts-ignore
      siblings[index + 1]?.data?.position ||
      null;

    return after && before && after === before
      ? generateJitteredKeyBetween(after, null)
      : generateJitteredKeyBetween(after, before);
  }

  function updateNodePosition(id: string, position: string) {
    tree.update({
      id,
      changes: { position } as any,
    });
  }

  function maybeUpdateOldParent(
    previousParent: NodeApi<SpaceTreeNode>,
    newParentId: string | null,
    movedId: string,
  ) {
    const isRoot = previousParent.id === "__REACT_ARBORIST_INTERNAL_ROOT__";
    if (previousParent.id !== newParentId && !isRoot) {
      const remaining = previousParent.children.filter((c) => c.id !== movedId);
      if (remaining.length === 0) {
        tree.update({
          id: previousParent.id,
          changes: { ...previousParent.data, hasChildren: false } as any,
        });
      }
    }
  }

  async function performBackendMove(
    action: onMoveActions | undefined,
    pageId: string,
    spaceId: string,
    parentPageId: string | null,
    position: string,
  ) {
    switch (action) {
      case "copy":
        return copyPageMutation.mutateAsync({
          originPageId: pageId,
          spaceId,
          parentPageId,
        });
      case "sync":
        return createSyncPageMutation.mutateAsync({
          originPageId: pageId,
          spaceId,
          parentPageId,
        });
      case "move":
        return movePageToSpace({ pageId, spaceId, parentPageId });
      default:
        return movePageMutation.mutateAsync({
          pageId,
          position,
          parentPageId,
          isMyPages: true,
          personalSpaceId: spaceId,
        });
    }
  }

  function updateNodeSpaceAndParent(
    id: string,
    spaceId: string,
    parentId: string,
  ) {
    tree.update({ id, changes: { spaceId, parentPageId: parentId } });
  }

  function emitMove(
    id: string,
    parentId: string | null,
    index: number,
    position: string,
  ) {
    setTimeout(() => {
      emit({
        operation: "moveTreeNode",
        spaceId,
        payload: { id, parentId, index, position },
      });
    }, 50);
  }

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
