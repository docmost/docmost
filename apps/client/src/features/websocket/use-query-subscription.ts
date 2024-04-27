import React from "react";
import { socketAtom } from "@/features/websocket/atoms/socket-atom.ts";
import { useAtom } from "jotai";
import { useQueryClient } from "@tanstack/react-query";
import { WebSocketEvent } from "@/features/websocket/types";

export const useQuerySubscription = () => {
  const queryClient = useQueryClient();
  const [socket] = useAtom(socketAtom);

  React.useEffect(() => {
    socket?.on("message", (event) => {
      const data: WebSocketEvent = event;

      switch (data.operation) {
        case "invalidate":
          queryClient.invalidateQueries({
            queryKey: [...data.entity, data.id].filter(Boolean),
          });
          break;
        case "updateOne":
          queryClient.setQueryData([...data.entity, data.id], {
            ...queryClient.getQueryData([...data.entity, data.id]),
            ...data.payload,
          });

          /*
          queryClient.setQueriesData(
            { queryKey: [data.entity, data.id] },
            (oldData: any) => {
              const update = (entity: Record<string, unknown>) =>
                entity.id === data.id ? { ...entity, ...data.payload } : entity;
              return Array.isArray(oldData)
                ? oldData.map(update)
                : update(oldData as Record<string, unknown>);
            },
          );
      */
          break;
      }
    });
  }, [queryClient, socket]);
};
