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
import { 
  insertItemsAtTarget,
  isOrderedDragTarget,
  removeItemsFromParents,
  type DragTarget,
  type ItemInstance
} from "@headless-tree/core";
import { emit } from "process";

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
    const parentId = parent.getId() === "root" ? null : parent.getId();
    let createdPage: IPage;
    try {
      const payload = { parentPageId: parentId, spaceId };
      createdPage = await createPageMutation.mutateAsync(payload);
    } catch (err) {
      throw new Error("Failed to create page");
    }

    const newItem = {
      id: createdPage.id,
      slugId: createdPage.slugId,
      name: createdPage.title ?? "",
      position: createdPage.position,
      spaceId: createdPage.spaceId,
      parentPageId: createdPage.parentPageId,
      children: [],
      hasChildren: false
    };

    const siblings = parent.getChildren();
    const index = siblings.length;
    parent.updateCachedChildrenIds([
      ...siblings.map(sibling => sibling.getId()),
      newItem.id
    ]);
    parent.getTree().getItemInstance(newItem.id).updateCachedData(newItem);

    setTimeout(() => {
      emit({
        operation: "addTreeNode",
        spaceId: spaceId,
        payload: {
          parentId,
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

    const afterPosition = newSiblings[newDragIndex - 1]?.getItemData()?.position ?? null;
    const beforePosition = newSiblings[newDragIndex + 1]?.getItemData()?.position ?? null;

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
      
      await removeItemsFromParents(items, (item, newChildren) => {
        item.updateCachedData({
          ...item.getItemData(),
          hasChildren: newChildren.length > 0,
        });
      });
      await insertItemsAtTarget(items.map(item => item.getId()), target, (item, newChildren) => {
        item.updateCachedData({
          ...item.getItemData(),
          hasChildren: newChildren.length > 0,
        });
      });
      for (const it of items) {
        it.updateCachedData({
          ...it.getItemData(),
          parentPageId,
          position: newPosition,
        });
      }
      // The lines above update the HT children cache. We could also just invalidate the
      // cache like below, and wait for the next refetch to update the children:
      // await Promise.all(items.map(item => item.getParent()?.invalidateChildrenIds()));
      // await target.item.invalidateChildrenIds();

      if (!target.item.isExpanded()) requestAnimationFrame(() => target.item.expand());
    } catch (error) {
      console.error("Error moving page:", error);
    }

    
  };

  const rename = async (item: ItemInstance<SpaceTreeNode>, name: string) => {
    try {
      await updatePageMutation.mutateAsync({ pageId: item.getId(), title: name });
      item.updateCachedData({
        ...item.getItemData(),
        name,
      });
    } catch (error) {
      console.error("Error updating page title:", error);
    }
  };

  const isPageInNode = (pageSlug: string, node: ItemInstance<SpaceTreeNode>) => {
    const tree = node.getTree();
    if (node.getItemData().slugId === pageSlug) return true;
    if (!node.isFolder()) return false;
    const children = tree.retrieveChildrenIds(node.getId(), true);
    return children.some(child => isPageInNode(pageSlug, tree.getItemInstance(child)));
  };

  const deleteItems = async (...items: ItemInstance<SpaceTreeNode>[]) => {
    try {
      const removedIds = items.map(item => item.getId());
      const parents = [...new Set(items.map(item => item.getParent().getId()))];
      await Promise.all(items.map(item => removePageMutation.mutateAsync(item.getId())));
      await Promise.all(parents.map(parentId => {
        const parent = items[0].getTree().getItemInstance(parentId);
        parent?.updateCachedChildrenIds(
          parent?.getChildren()
            .map(child => child.getId())
            .filter(child => !removedIds.includes(child))
          );
      }));

      setTimeout(() => {
        items.map(item => item.getItemData())
          .filter(Boolean)
          .forEach(node => emit({
            operation: "deleteTreeNode",
            spaceId: spaceId,
            payload: { node },
          }));
      }, 50);

      const slugId = pageSlug?.split("-")?.at(-1);
      if (slugId && items.some(item => isPageInNode(slugId, item))) {
        navigate(getSpaceUrl(spaceSlug));
      }
    } catch (error) {
      console.error("Failed to delete page:", error);
    }
  };

  return { delete: deleteItems, rename, move, create } as const;
}
