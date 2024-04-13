import { useMemo } from "react";
import {
  CreateHandler,
  DeleteHandler,
  MoveHandler,
  RenameHandler,
  SimpleTree,
} from "react-arborist";
import { useAtom } from "jotai";
import { treeDataAtom } from "@/features/page/tree/atoms/tree-data-atom";
import { movePage } from "@/features/page/services/page-service";
import { v4 as uuidv4 } from "uuid";
import { IMovePage } from "@/features/page/types/page.types";
import { useNavigate } from "react-router-dom";
import { TreeNode } from "@/features/page/tree/types";
import {
  useCreatePageMutation,
  useDeletePageMutation,
  useUpdatePageMutation,
} from "@/features/page/queries/page-query";

interface Props {
  spaceId: string;
}
export function usePersistence<T>(spaceId: string) {
  const [data, setData] = useAtom(treeDataAtom);
  const createPageMutation = useCreatePageMutation();
  const updatePageMutation = useUpdatePageMutation();
  const deletePageMutation = useDeletePageMutation();

  const navigate = useNavigate();

  const tree = useMemo(() => new SimpleTree<TreeNode>(data), [data]);

  const onMove: MoveHandler<T> = (args: {
    parentId;
    index;
    parentNode;
    dragNodes;
    dragIds;
  }) => {
    for (const id of args.dragIds) {
      tree.move({ id, parentId: args.parentId, index: args.index });
    }
    setData(tree.data);

    const newDragIndex = tree.find(args.dragIds[0])?.childIndex;

    const currentTreeData = args.parentId
      ? tree.find(args.parentId).children
      : tree.data;
    const afterId = currentTreeData[newDragIndex - 1]?.id || null;
    const beforeId =
      (!afterId && currentTreeData[newDragIndex + 1]?.id) || null;

    const params: IMovePage = {
      pageId: args.dragIds[0],
      after: afterId,
      before: beforeId,
      parentId: args.parentId || null,
    };

    const payload = Object.fromEntries(
      Object.entries(params).filter(
        ([key, value]) => value !== null && value !== undefined,
      ),
    );

    try {
      movePage(payload as IMovePage);
    } catch (error) {
      console.error("Error moving page:", error);
    }
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

  const onCreate: CreateHandler<T> = async ({ parentId, index, type }) => {
    const data = { id: uuidv4(), name: "" } as any;
    data.children = [];
    tree.create({ parentId, index, data });
    setData(tree.data);

    const payload: { pageId: string; parentPageId?: string; spaceId: string } =
      {
        pageId: data.id,
        spaceId: spaceId,
      };
    if (parentId) {
      payload.parentPageId = parentId;
    }

    try {
      await createPageMutation.mutateAsync(payload);
      navigate(`/p/${payload.pageId}`);
    } catch (error) {
      console.error("Error creating the page:", error);
    }

    return data;
  };

  const onDelete: DeleteHandler<T> = async (args: { ids: string[] }) => {
    args.ids.forEach((id) => tree.drop({ id }));
    setData(tree.data);

    try {
      await deletePageMutation.mutateAsync(args.ids[0]);
      navigate("/home");
    } catch (error) {
      console.error("Error deleting page:", error);
    }
  };

  const controllers = { onMove, onRename, onCreate, onDelete };

  return { data, setData, controllers } as const;
}
