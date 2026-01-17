import { useEffect, useRef, useCallback, useMemo } from "react";
import { useAtom } from "jotai";
import { socketAtom } from "@/features/websocket/atoms/socket-atom";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/element/types";
import { reconcileElements, getSceneVersion } from "@excalidraw/excalidraw";
import throttle from "lodash.throttle";

type Collaborator = {
  socketId: string;
  isCurrentUser?: boolean;
};

export function useExcalidrawCollab(
  excalidrawAPI: ExcalidrawImperativeAPI | null,
  pageId: string | undefined,
  isOpen: boolean,
) {
  const [socket] = useAtom(socketAtom);
  const lastBroadcastedVersion = useRef(-1);
  const isInitialized = useRef(false);

  const roomId = pageId ? `excalidraw-${pageId}` : null;

  // Create stable throttled broadcast function
  const broadcastScene = useMemo(
    () =>
      throttle((elements: readonly ExcalidrawElement[]) => {
        if (!socket || !roomId || !isInitialized.current) {
          console.log("broadcastScene: not ready", {
            socket: !!socket,
            roomId,
            isInitialized: isInitialized.current,
          });
          return;
        }

        // getSceneVersion sums all element versions - increases on ANY change
        const sceneVersion = getSceneVersion(elements);

        if (sceneVersion <= lastBroadcastedVersion.current) {
          return;
        }

        const data = {
          type: "SCENE_UPDATE",
          payload: { elements },
        };

        // Send as plain JSON for now (no encryption)
        const json = JSON.stringify(data);
        console.log("Broadcasting scene, version:", sceneVersion);

        socket.emit("server-broadcast", [roomId, json, null]);
        lastBroadcastedVersion.current = sceneVersion;
      }, 100),
    [socket, roomId],
  );

  // Handle incoming broadcasts
  const handleClientBroadcast = useCallback(
    (jsonData: string, _iv: Uint8Array | null) => {
      if (!excalidrawAPI) return;

      try {
        const data = JSON.parse(jsonData);

        if (data.type === "SCENE_UPDATE" && data.payload?.elements) {
          const remoteElements = data.payload.elements;
          const localElements =
            excalidrawAPI.getSceneElementsIncludingDeleted();

          const reconciledElements = reconcileElements(
            localElements,
            remoteElements,
            excalidrawAPI.getAppState(),
          );

          excalidrawAPI.updateScene({
            elements: reconciledElements,
          });

          // Update version to prevent echo
          lastBroadcastedVersion.current = getSceneVersion(reconciledElements);
        }
      } catch (err) {
        console.error("Failed to process broadcast:", err);
      }
    },
    [excalidrawAPI],
  );

  // Handle room user changes
  const handleRoomUserChange = useCallback(
    (socketIds: string[]) => {
      if (!excalidrawAPI || !socket) return;

      const collaborators = new Map<string, Collaborator>();
      for (const id of socketIds) {
        collaborators.set(id, {
          socketId: id,
          isCurrentUser: id === socket.id,
        });
      }
      // @ts-ignore
      excalidrawAPI.updateScene({ collaborators });
    },
    [excalidrawAPI, socket],
  );

  // Join/leave room based on modal state
  useEffect(() => {
    if (!socket || !roomId || !isOpen) return;

    console.log("Joining room:", roomId);
    socket.emit("join-room", roomId);
    isInitialized.current = true;

    // Set up listeners
    socket.on("client-broadcast", handleClientBroadcast);
    socket.on("room-user-change", handleRoomUserChange);
    socket.on("first-in-room", () => {
      console.log("First in excalidraw room");
    });
    socket.on("new-user", (socketId: string) => {
      console.log("New user joined:", socketId);
      if (excalidrawAPI) {
        broadcastScene(excalidrawAPI.getSceneElements());
      }
    });

    return () => {
      console.log("Leaving room:", roomId);
      socket.emit("leave-room", roomId);
      socket.off("client-broadcast", handleClientBroadcast);
      socket.off("room-user-change", handleRoomUserChange);
      socket.off("first-in-room");
      socket.off("new-user");
      isInitialized.current = false;
      lastBroadcastedVersion.current = -1;
    };
  }, [socket, roomId, isOpen, handleClientBroadcast, handleRoomUserChange, broadcastScene, excalidrawAPI]);

  return { broadcastScene };
}
