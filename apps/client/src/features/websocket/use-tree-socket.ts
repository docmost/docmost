import { useEffect } from "react";
import { socketAtom } from "@/features/websocket/atoms/socket-atom.ts";
import { useAtom } from "jotai";
import { treeDataAtom } from "@/features/page/tree/atoms/tree-data-atom.ts";
import { WebSocketEvent } from "@/features/websocket/types";
import { useQueryClient } from "@tanstack/react-query";
import localEmitter from "@/lib/local-emitter.ts";

export const useTreeSocket = () => {
  const [socket] = useAtom(socketAtom);
  const [{ tree }] = useAtom(treeDataAtom);
  const queryClient = useQueryClient();

  useEffect(() => {
    const updateNodeName = (event) => {
      const item = tree?.getItemInstance(event?.id);
      if (!item || event.payload?.title === undefined) return;
      item.updateCachedData({
        ...item.getItemData(),
        name: event?.payload?.title ?? item.getItemData().name,
      });
    };

    localEmitter.on("message", updateNodeName);
    return () => {
      localEmitter.off("message", updateNodeName);
    };
  }, [tree]);

  useEffect(() => {
    const handler = (event: WebSocketEvent) => {
      switch (event.operation) {
        case "updateOne":
          if (event.entity[0] === "pages") {
            const item = tree?.getItemInstance(event.id);
            if (item) {
              if (event.payload?.title !== undefined) {
                item.updateCachedData({
                  ...item.getItemData(),
                  name: event.payload.title,
                });
              }
              if (event.payload?.icon !== undefined) {
                item.updateCachedData({
                  ...item.getItemData(),
                  icon: event.payload.icon,
                });
              }
            }
          }
          break;
        case "addTreeNode": {
          tree?.getItemInstance(event.payload.parentId)?.invalidateChildrenIds();
          break;
        }
        case "moveTreeNode":
          tree?.getItemInstance(event.payload.id).getParent()?.invalidateChildrenIds();
          tree?.getItemInstance(event.payload.parentId)?.invalidateChildrenIds();

          break;
        case "deleteTreeNode":
          tree?.getItemInstance(event.payload.node.id)?.getParent()?.invalidateChildrenIds();
          break;
      }
    };
    socket?.on("message", handler);
    return () => { socket?.off("message", handler) };
  }, [tree, socket]);
};
