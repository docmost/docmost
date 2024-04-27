import { useEffect, useRef } from "react";
import { socketAtom } from "@/features/websocket/atoms/socket-atom.ts";
import { useAtom } from "jotai";
import { treeDataAtom } from "@/features/page/tree/atoms/tree-data-atom.ts";
import {
  updateTreeNodeIcon,
  updateTreeNodeName,
} from "@/features/page/tree/utils";
import { WebSocketEvent } from "@/features/websocket/types";
import { SpaceTreeNode } from "@/features/page/tree/types.ts";

export const useTreeSocket = () => {
  const [socket] = useAtom(socketAtom);
  const [treeData, setTreeData] = useAtom(treeDataAtom);

  const initialTreeData = useRef(treeData);

  useEffect(() => {
    initialTreeData.current = treeData;
  }, [treeData]);

  useEffect(() => {
    socket?.on("message", (event) => {
      const data: WebSocketEvent = event;

      const initialData = initialTreeData.current;
      switch (data.operation) {
        case "invalidate":
          // nothing to do here
          break;
        case "updateOne":
          // Get the initial value of treeData
          if (initialData && initialData.length > 0) {
            let newTreeData: SpaceTreeNode[];

            if (data.entity[0] === "pages") {
              if (data.payload?.title !== undefined) {
                newTreeData = updateTreeNodeName(
                  initialData,
                  data.id,
                  data.payload.title,
                );
              }

              if (data.payload?.icon !== undefined) {
                newTreeData = updateTreeNodeIcon(
                  initialData,
                  data.id,
                  data.payload.icon,
                );
              }

              if (newTreeData && newTreeData.length > 0) {
                setTreeData(newTreeData);
              }
            }
          }
          break;
      }
    });
  }, [socket]);
};
