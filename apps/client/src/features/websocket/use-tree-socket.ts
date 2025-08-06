import { useEffect, useRef } from "react";
import { socketAtom } from "@/features/websocket/atoms/socket-atom.ts";
import { useAtom, useAtomValue } from "jotai";
import { treeDataAtom } from "@/features/page/tree/atoms/tree-data-atom.ts";
import { WebSocketEvent } from "@/features/websocket/types";
import { SpaceTreeNode } from "@/features/page/tree/types.ts";
import { useQueryClient } from "@tanstack/react-query";
import localEmitter from "@/lib/local-emitter.ts";
import { queryClient } from "@/main";

export const useTreeSocket = () => {
  const [socket] = useAtom(socketAtom);
  const treeAtom = useAtomValue(treeDataAtom);
  const queryClient = useQueryClient();

  useEffect(() => {
    const updateNodeName = (event) => {
      const item = treeAtom.tree.getItemInstance(event?.id);
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
  }, [treeAtom]);

  useEffect(() => {
    socket?.on("message", (event: WebSocketEvent) => {
      switch (event.operation) {
        case "updateOne":
          if (event.entity[0] === "pages") {
          const item = treeAtom.tree.getItemInstance(event.id);
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
          treeAtom.tree.getItemInstance(event.payload.parentId)?.invalidateChildrenIds(); 
          break;
        }
        case "moveTreeNode":
          treeAtom.tree.getItemInstance(event.payload.id).getParent()?.invalidateChildrenIds();
          treeAtom.tree.getItemInstance(event.payload.parentId)?.invalidateChildrenIds();

          break;
        case "deleteTreeNode":
          treeAtom.tree.getItemInstance(event.payload.node.id)?.getParent()?.invalidateChildrenIds();
          break;
      }
    });
  }, [treeAtom, socket]);
};
