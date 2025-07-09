import React from "react";
import { socketAtom } from "@/features/websocket/atoms/socket-atom.ts";
import { useAtom } from "jotai";
import { InfiniteData, useQueryClient } from "@tanstack/react-query";
import { WebSocketEvent } from "@/features/websocket/types";
import { IPage } from "../page/types/page.types";
import { IPagination } from "@/lib/types";
import {
  invalidateGraph,
  invalidateOnCreatePage,
  invalidateOnDeletePage,
  invalidateOnMovePage,
  invalidateOnUpdatePage,
} from "../page/queries/page-query";
import { RQ_KEY } from "../comment/queries/comment-query";
import { queryClient } from "@/main.tsx";

export const useQuerySubscription = () => {
  const queryClient = useQueryClient();
  const [socket] = useAtom(socketAtom);

  React.useEffect(() => {
    socket?.on("message", (event) => {
      const data: WebSocketEvent = event;

      let entity = null;
      let queryKeyId = null;

      switch (data.operation) {
        case "invalidate":
          queryClient.invalidateQueries({
            queryKey: [...data.entity, data.id].filter(Boolean),
          });
          break;
        case "invalidateComment":
          queryClient.invalidateQueries({
            queryKey: RQ_KEY(data.pageId),
          });
          break;
        case "addTreeNode":
          invalidateOnCreatePage(data.payload.data);
          invalidateGraph();
          break;
        case "moveTreeNode":
          invalidateOnMovePage();
          invalidateGraph();
          break;
        case "deleteTreeNode":
          const pageId = data.payload.node.id;
          invalidateOnDeletePage(pageId);
          invalidateGraph();
          invalidateOnDeletePage(pageId);
          break;
        case "updateOne":
          entity = data.entity[0];
          if (entity === "pages") {
            // we have to do this because the usePageQuery cache key is the slugId.
            queryKeyId = data.payload.slugId;
          } else {
            queryKeyId = data.id;
          }

          // only update if data was already in cache
          if (queryClient.getQueryData([...data.entity, queryKeyId])) {
            queryClient.setQueryData([...data.entity, queryKeyId], {
              ...queryClient.getQueryData([...data.entity, queryKeyId]),
              ...data.payload,
            });
          }

          if (entity === "pages") {
            invalidateOnUpdatePage(
              data.spaceId,
              data.payload.parentPageId,
              data.id,
              data.payload.title,
              data.payload.icon,
            );
          }

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
        case "refetchRootTreeNodeEvent": {
          const spaceId = data.spaceId;
          queryClient.refetchQueries({
            queryKey: ["root-sidebar-pages", spaceId],
          });

          queryClient.invalidateQueries({
            queryKey: ["recent-changes", spaceId],
          });
          break;
        }
      }
    });
  }, [queryClient, socket]);
};
