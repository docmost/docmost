import { socketAtom } from "@/features/websocket/atoms/socket-atom.ts";
import { useAtom } from "jotai";
import { WebSocketEvent } from "@/features/websocket/types";

export const useQueryEmit = () => {
  const [socket] = useAtom(socketAtom);

  return (input: WebSocketEvent) => {
    socket?.emit("message", input);
  };
};
