import { IMovePage, IPage } from "@/features/page/types/page.types.ts";
import { useNavigate, useParams } from "react-router-dom";
import {
  useCreatePageMutation,
  useRemovePageMutation,
  useMovePageMutation,
  useUpdatePageMutation,
} from "@/features/page/queries/page-query.ts";
import { generateJitteredKeyBetween } from "fractional-indexing-jittered";
import { SpaceTreeNode } from "@/features/page/tree/types.ts";
import { buildPageUrl } from "@/features/page/page.utils.ts";
import { getSpaceUrl } from "@/lib/config.ts";
import { useQueryEmit } from "@/features/websocket/use-query-emit.ts";
import { insertItemsAtTarget, isOrderedDragTarget, removeItemsFromParents, type DragTarget, type DragTargetPosition, type ItemInstance, type TreeInstance } from "@headless-tree/core";

export function useTreeMutation<T>(spaceId: string) {
  const createPageMutation = useCreatePageMutation();
  const updatePageMutation = useUpdatePageMutation();
  const removePageMutation = useRemovePageMutation();
  const movePageMutation = useMovePageMutation();
  const navigate = useNavigate();
  const { spaceSlug } = useParams();
  const { pageSlug } = useParams();
  const emit = useQueryEmit();

  const create = async (parent: ItemInstance<SpaceTreeNode>) => {
    let createdPage: IPage;
    try {
      const payload = { parentPageId: parent?.getId(), spaceId };
      createdPage = await createPageMutation.mutateAsync(payload);
    } catch (err) {
      throw new Error("Failed to create page");
    }

    const newItem = {
      id: createdPage.id,
      slugId: createdPage.slugId,
      name: "",
      position: createdPage.position,
      spaceId: createdPage.spaceId,
      parentPageId: createdPage.parentPageId,
      children: [],
      hasChildren: false
    };

    const index = parent.getChildren().length;
    await parent.invalidateChildrenIds();

    setTimeout(() => {
      emit({
        operation: "addTreeNode",
        spaceId: spaceId,
        payload: {
          parentId: parent.getId() === "root" ? null : parent.getId(),
          index,
          data: newItem,
        },
      });
    }, 50);

    const pageUrl = buildPageUrl(
      spaceSlug,
      createdPage.slugId,
      createdPage.title
    );
    navigate(pageUrl);
    return newItem;
  };

  const move = async (items: ItemInstance<SpaceTreeNode>[], target: DragTarget<SpaceTreeNode>) => {
    const draggedNodeId = items[0].getId();


    const newSiblings = target.item.getChildren();
    const newDragIndex = isOrderedDragTarget(target) ? target.childIndex : newSiblings.length;

    // if there is a parentId, tree.find(args.parentId).children returns a SimpleNode array
    // we have to access the node differently via currentTreeData[args.index]?.data?.position
    // this makes it possible to correctly sort children of a parent node that is not the root

    const afterPosition = newSiblings[newDragIndex - 1]?.getItemData()?.position || null;
    const beforePosition = newSiblings[newDragIndex]?.getItemData()?.position || null;

    let newPosition: string;

    if (afterPosition && beforePosition && afterPosition === beforePosition) {
      // if after is equal to before, put it next to the after node
      newPosition = generateJitteredKeyBetween(afterPosition, null);
    } else {
      // if both are null then, it is the first index
      newPosition = generateJitteredKeyBetween(afterPosition, beforePosition);
    }


    const parentPageId = target.item.getId() === "root" ? null : target.item.getId();
    const payload: IMovePage = {
      pageId: draggedNodeId,
      position: newPosition,
      parentPageId,
    };
    console.log("move payload", {
      pageId: draggedNodeId,
      position: newPosition,
      parentPageId,
    })

    // TODO set hasChildren to false if item has no children after moving

    try {
      await movePageMutation.mutateAsync(payload);

      emit({
        operation: "moveTreeNode",
        spaceId: spaceId,
        payload: {
          id: draggedNodeId,
          parentId: parentPageId,
          index: newDragIndex,
          position: newPosition,
        },
      });
      
    await removeItemsFromParents(items, () => {});
    await insertItemsAtTarget(items.map(item => item.getId()), target, () => {});
    // The lines above update the HT children cache. We could also just invalidate the
    // cache like below, and wait for the next refetch to update the children:
    // await Promise.all(items.map(item => item.getParent()?.invalidateChildrenIds()));
    // await target.item.invalidateChildrenIds();

    console.log("!!expanding", target.item.getItemName());
    setTimeout(target.item.expand);
    } catch (error) {
      console.error("Error moving page:", error);
    }

    
  };

  const rename = (item: ItemInstance<SpaceTreeNode>, name: string) => {
    try {
      updatePageMutation.mutateAsync({ pageId: item.getId(), title: name });
      item.updateCachedData({
        ...item.getItemData(),
        name,
      });
    } catch (error) {
      console.error("Error updating page title:", error);
    }
  };

  const deleteItems = async (...items: ItemInstance<SpaceTreeNode>[]) => {
    try {
      await Promise.all(items.map(item => removePageMutation.mutateAsync(item.getId())));
      await Promise.all(items.map(item => item.getParent()?.invalidateChildrenIds()));

      const navigateItem = items.reduce(
        (found, item) => found ?? item.getParent(),
        null
      );

      if (navigateItem) {
        navigate(getSpaceUrl(navigateItem.getItemData().slugId));
      }

      setTimeout(() => {
        items.map(item => item.getItemData())
          .filter(Boolean)
          .forEach(node => emit({
            operation: "deleteTreeNode",
            spaceId: spaceId,
            payload: { node },
          }));
      }, 50);
    } catch (error) {
      console.error("Failed to delete page:", error);
    }
  };

  return { delete: deleteItems, rename, move, create } as const;
}
