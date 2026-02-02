import React from "react";
import { socketAtom } from "@/features/websocket/atoms/socket-atom.ts";
import { useAtom } from "jotai";
import { InfiniteData, useQueryClient } from "@tanstack/react-query";
import { WebSocketEvent } from "@/features/websocket/types";
import { IPage } from "../page/types/page.types";
import { IPagination } from "@/lib/types";
import {
  invalidateOnCreatePage,
  invalidateOnDeletePage,
  updateCacheOnMovePage,
  invalidateOnUpdatePage,
} from "../page/queries/page-query";
import { RQ_KEY } from "../comment/queries/comment-query";
import { queryClient } from "@/main.tsx";
import { IComment } from "@/features/comment/types/comment.types";

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
          break;
        case "moveTreeNode":
          updateCacheOnMovePage(
            data.spaceId,
            data.payload.id,
            data.payload.oldParentId,
            data.payload.parentId,
            data.payload.pageData,
          );
          break;
        case "deleteTreeNode":
          invalidateOnDeletePage(data.payload.node.id);
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
        case "resolveComment": {
          const currentComments = queryClient.getQueryData(
            RQ_KEY(data.pageId),
          ) as IPagination<IComment>;

          if (currentComments && currentComments.items) {
            const updatedComments = currentComments.items.map((comment) =>
              comment.id === data.commentId
                ? { 
                    ...comment, 
                    resolvedAt: data.resolvedAt, 
                    resolvedById: data.resolvedById, 
                    resolvedBy: data.resolvedBy 
                  }
                : comment,
            );
            
            queryClient.setQueryData(RQ_KEY(data.pageId), {
              ...currentComments,
              items: updatedComments,
            });
          }
          break;
        }
      }
    });
  }, [queryClient, socket]);
};
