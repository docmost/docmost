import { useEffect } from "react";
import { socketAtom } from "@/features/websocket/atoms/socket-atom.ts";
import { useAtom } from "jotai";
import { treeDataAtom } from "@/features/page/tree/atoms/tree-data-atom.ts";
import { favTreeDataAtom } from "@/features/page/tree/atoms/fav-tree-data-atom.ts";
import { WebSocketEvent } from "@/features/websocket/types";
import { useQueryClient } from "@tanstack/react-query";
import { applyTreeEvent } from "./apply-tree-event";
import localEmitter from "@/lib/local-emitter.ts";

// Keeps both the main Pages tree (treeDataAtom) and the Starred shortcuts
// tree (favTreeDataAtom) in sync with tree-affecting page changes.
//
// Two event sources feed the same handler:
// - `socket`, for changes made by other clients/tabs — the server uses
//   `client.broadcast`, which deliberately excludes the emitting socket.
// - `localEmitter`, a same-tab event bus — mutation handlers (useTreeMutation,
//   the emoji picker, title editor, etc.) emit here in addition to the real
//   websocket emit specifically because of the above: the tab that made the
//   change never gets its own event back over the socket, so without this it
//   would only see the change after a full reload.
export const useTreeSocket = () => {
  const [socket] = useAtom(socketAtom);
  const [, setTreeData] = useAtom(treeDataAtom);
  const [, setFavTreeData] = useAtom(favTreeDataAtom);
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleEvent = (event: WebSocketEvent) => {
      setTreeData((prev) => applyTreeEvent(prev, event));
      setFavTreeData((prev) =>
        applyTreeEvent(prev, event, { preserveRoots: true }),
      );

      if (event.operation === "deleteTreeNode") {
        queryClient.invalidateQueries({
          queryKey: ["pages", event.payload.node.slugId].filter(Boolean),
        });
      }
    };

    socket?.on("message", handleEvent);
    localEmitter.on("message", handleEvent);
    return () => {
      socket?.off("message", handleEvent);
      localEmitter.off("message", handleEvent);
    };
  }, [socket, queryClient, setTreeData, setFavTreeData]);
};
