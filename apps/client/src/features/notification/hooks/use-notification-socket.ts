import { useEffect } from "react";
import { useAtom } from "jotai";
import { useQueryClient } from "@tanstack/react-query";
import { socketAtom } from "@/features/websocket/atoms/socket-atom";
import { NOTIFICATION_KEY } from "../queries/notification-query";

export function useNotificationSocket() {
  const queryClient = useQueryClient();
  const [socket] = useAtom(socketAtom);

  useEffect(() => {
    if (!socket) return;

    const handler = () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATION_KEY });
    };

    socket.on("notification", handler);
    return () => {
      socket.off("notification", handler);
    };
  }, [socket, queryClient]);
}
