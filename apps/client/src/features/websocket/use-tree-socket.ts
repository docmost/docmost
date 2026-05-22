import { useEffect } from "react";
import { socketAtom } from "@/features/websocket/atoms/socket-atom.ts";
import { useAtom } from "jotai";
import { treeDataAtom } from "@/features/page/tree/atoms/tree-data-atom.ts";
import { WebSocketEvent } from "@/features/websocket/types";
import { SpaceTreeNode } from "@/features/page/tree/types.ts";
import { useQueryClient } from "@tanstack/react-query";
import { treeModel } from "@/features/page/tree/model/tree-model";
import localEmitter from "@/lib/local-emitter.ts";

export const useTreeSocket = () => {
  const [socket] = useAtom(socketAtom);
  const [, setTreeData] = useAtom(treeDataAtom);
  const queryClient = useQueryClient();

  useEffect(() => {
    const updateNodeName = (event) => {
      if (event.payload?.title === undefined) return;
      setTreeData((prev) => {
        if (!treeModel.find(prev, event?.id)) return prev;
        return treeModel.update(prev, event.id, {
          name: event.payload.title,
        } as Partial<SpaceTreeNode>);
      });
    };

    localEmitter.on("message", updateNodeName);
    return () => {
      localEmitter.off("message", updateNodeName);
    };
  }, []);

  useEffect(() => {
    socket?.on("message", (event: WebSocketEvent) => {
      switch (event.operation) {
        case "updateOne":
          if (event.entity[0] === "pages") {
            setTreeData((prev) => {
              if (!treeModel.find(prev, event.id)) return prev;
              let next = prev;
              if (event.payload?.title !== undefined) {
                next = treeModel.update(next, event.id, {
                  name: event.payload.title,
                } as Partial<SpaceTreeNode>);
              }
              if (event.payload?.icon !== undefined) {
                next = treeModel.update(next, event.id, {
                  icon: event.payload.icon,
                } as Partial<SpaceTreeNode>);
              }
              return next;
            });
          }
          break;
        case "addTreeNode":
          setTreeData((prev) => {
            if (treeModel.find(prev, event.payload.data.id)) return prev;
            const newParentId = event.payload.parentId as string | null;
            let next = treeModel.insert(
              prev,
              newParentId,
              event.payload.data,
              event.payload.index,
            );
            // Mirror the emitter: flip new parent's hasChildren to true so
            // the chevron renders on the receiver.
            if (newParentId) {
              next = treeModel.update(next, newParentId, {
                hasChildren: true,
              } as Partial<SpaceTreeNode>);
            }
            return next;
          });
          break;
        case "moveTreeNode":
          setTreeData((prev) => {
            const sourceBefore = treeModel.find(prev, event.payload.id);
            if (!sourceBefore) return prev;
            const oldParentId =
              (sourceBefore as SpaceTreeNode).parentPageId ?? null;
            const newParentId = event.payload.parentId as string | null;

            const placed = treeModel.place(prev, event.payload.id, {
              parentId: newParentId,
              index: event.payload.index,
            });
            // `place` silently returns the same reference if the destination
            // parent isn't loaded on this client. Falling back to removing the
            // source keeps the UI consistent (the source will reappear when
            // the user expands the new parent and lazy-load fetches it).
            if (placed === prev) {
              return treeModel.remove(prev, event.payload.id);
            }

            let next = treeModel.update(placed, event.payload.id, {
              position: event.payload.position,
              parentPageId: newParentId,
            } as Partial<SpaceTreeNode>);

            // Mirror the emitter's hasChildren bookkeeping so both clients
            // converge to the same chevron state.
            if (oldParentId) {
              const oldParent = treeModel.find(next, oldParentId);
              if (!oldParent?.children?.length) {
                next = treeModel.update(next, oldParentId, {
                  hasChildren: false,
                } as Partial<SpaceTreeNode>);
              }
            }
            if (newParentId) {
              next = treeModel.update(next, newParentId, {
                hasChildren: true,
              } as Partial<SpaceTreeNode>);
            }

            return next;
          });
          break;
        case "deleteTreeNode":
          setTreeData((prev) => {
            if (!treeModel.find(prev, event.payload.node.id)) return prev;
            queryClient.invalidateQueries({
              queryKey: ["pages", event.payload.node.slugId].filter(Boolean),
            });
            let next = treeModel.remove(prev, event.payload.node.id);
            // Mirror the emitter's hasChildren bookkeeping so both clients
            // converge to the same chevron state when the last child is deleted.
            const parentPageId = event.payload.node.parentPageId;
            if (parentPageId) {
              const parent = treeModel.find(next, parentPageId);
              if (!parent?.children?.length) {
                next = treeModel.update(next, parentPageId, {
                  hasChildren: false,
                } as Partial<SpaceTreeNode>);
              }
            }
            return next;
          });
          break;
      }
    });
  }, [socket]);
};
