import { useEffect, useRef, useCallback, useMemo, useState } from "react";
import { useAtom } from "jotai";
import { socketAtom } from "@/features/websocket/atoms/socket-atom";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";
import type {
  ExcalidrawImperativeAPI,
  Collaborator,
  Gesture,
} from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/element/types";
import { reconcileElements, getSceneVersion } from "@excalidraw/excalidraw";
import throttle from "lodash.throttle";

// Message types for collaboration
type SceneUpdateMessage = {
  type: "SCENE_UPDATE";
  payload: { elements: readonly ExcalidrawElement[] };
};

type PointerUpdateMessage = {
  type: "POINTER_UPDATE";
  payload: {
    socketId: string;
    pointer: { x: number; y: number };
    button: "down" | "up";
    username: string;
    selectedElementIds: Record<string, boolean>;
  };
};

type CollabMessage = SceneUpdateMessage | PointerUpdateMessage;

export function useExcalidrawCollab(
  excalidrawAPI: ExcalidrawImperativeAPI | null,
  pageId: string | undefined,
  isOpen: boolean,
) {
  const [socket] = useAtom(socketAtom);
  const [currentUser] = useAtom(currentUserAtom);
  const lastBroadcastedVersion = useRef(-1);
  const isInitialized = useRef(false);
  const collaboratorsRef = useRef<Map<string, Collaborator>>(new Map());
  const [isCollaborating, setIsCollaborating] = useState(false);

  const roomId = pageId ? `excalidraw-${pageId}` : null;
  const username = currentUser?.user?.name || "Anonymous";

  // Broadcast pointer/cursor updates (volatile - can be dropped)
  const broadcastPointer = useMemo(
    () =>
      throttle(
        (payload: {
          pointer: { x: number; y: number };
          button: "down" | "up";
          pointersMap: Gesture["pointers"];
        }) => {
          if (!socket || !roomId || !isInitialized.current) return;
          if (payload.pointersMap.size >= 2) return; // Skip multi-touch

          const data: PointerUpdateMessage = {
            type: "POINTER_UPDATE",
            payload: {
              socketId: socket.id!,
              pointer: payload.pointer,
              button: payload.button,
              username,
              selectedElementIds:
                excalidrawAPI?.getAppState().selectedElementIds || {},
            },
          };

          const json = JSON.stringify(data);
          socket.emit("server-volatile-broadcast", [roomId, json, null]);
        },
        50,
      ),
    [socket, roomId, username, excalidrawAPI],
  );

  // Broadcast scene changes
  const broadcastScene = useMemo(
    () =>
      throttle((elements: readonly ExcalidrawElement[]) => {
        if (!socket || !roomId || !isInitialized.current) {
          return;
        }

        const sceneVersion = getSceneVersion(elements);

        if (sceneVersion <= lastBroadcastedVersion.current) {
          return;
        }

        const data: SceneUpdateMessage = {
          type: "SCENE_UPDATE",
          payload: { elements },
        };

        const json = JSON.stringify(data);
        socket.emit("server-broadcast", [roomId, json, null]);
        lastBroadcastedVersion.current = sceneVersion;
      }, 100),
    [socket, roomId],
  );

  // Handle incoming broadcasts
  const handleClientBroadcast = useCallback(
    (jsonData: string, _iv: Uint8Array | null) => {
      if (!excalidrawAPI || !socket) return;

      try {
        const data: CollabMessage = JSON.parse(jsonData);

        if (data.type === "SCENE_UPDATE" && data.payload?.elements) {
          const remoteElements = data.payload.elements;
          const localElements =
            excalidrawAPI.getSceneElementsIncludingDeleted();

          const reconciledElements = reconcileElements(
            localElements,
            // @ts-ignore
            remoteElements,
            excalidrawAPI.getAppState(),
          );

          excalidrawAPI.updateScene({
            elements: reconciledElements,
          });

          lastBroadcastedVersion.current = getSceneVersion(reconciledElements);
        } else if (data.type === "POINTER_UPDATE") {
          const { socketId, pointer, button, username, selectedElementIds } =
            data.payload;

          // Don't update our own cursor
          if (socketId === socket.id) return;

          // Update collaborator with pointer info
          const collaborator = collaboratorsRef.current.get(socketId) || {};
          collaboratorsRef.current.set(socketId, {
            ...collaborator,
            // @ts-ignore
            pointer,
            button,
            username,
            // @ts-ignore
            selectedElementIds,
            isCurrentUser: false,
          });

          excalidrawAPI.updateScene({
            // @ts-ignore
            collaborators: collaboratorsRef.current,
          });
        }
      } catch (err) {
        console.error("Failed to process broadcast:", err);
      }
    },
    [excalidrawAPI, socket],
  );

  // Handle room user changes
  const handleRoomUserChange = useCallback(
    (socketIds: string[]) => {
      if (!excalidrawAPI || !socket) return;

      // Update collaborators map, preserving existing data
      const newCollaborators = new Map<string, Collaborator>();
      for (const id of socketIds) {
        const existing = collaboratorsRef.current.get(id);
        newCollaborators.set(id, {
          ...existing,
          isCurrentUser: id === socket.id,
          username:
            existing?.username || (id === socket.id ? username : "User"),
        });
      }

      collaboratorsRef.current = newCollaborators;
      // @ts-ignore
      excalidrawAPI.updateScene({ collaborators: newCollaborators });

      // We're collaborating if there are other users
      setIsCollaborating(socketIds.length > 1);
    },
    [excalidrawAPI, socket, username],
  );

  // Join/leave room based on modal state
  useEffect(() => {
    if (!socket || !roomId || !isOpen) {
      setIsCollaborating(false);
      return;
    }

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
      collaboratorsRef.current = new Map();
      setIsCollaborating(false);
    };
  }, [
    socket,
    roomId,
    isOpen,
    handleClientBroadcast,
    handleRoomUserChange,
    broadcastScene,
    excalidrawAPI,
  ]);

  return {
    broadcastScene,
    broadcastPointer,
    isCollaborating,
  };
}
