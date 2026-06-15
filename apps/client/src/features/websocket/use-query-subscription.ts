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
import { IComment } from "@/features/comment/types/comment.types";

export const useQuerySubscription = () => {
  const queryClient = useQueryClient();
  const [socket] = useAtom(socketAtom);

  React.useEffect(() => {
    socket?.on("message", (event) => {
      const data: WebSocketEvent = event;

      let entity = null;

      switch (data.operation) {
        case "invalidate":
          queryClient.invalidateQueries({
            queryKey: [...data.entity, data.id].filter(Boolean),
          });
          break;
        case "commentCreated": {
          const createCache = queryClient.getQueryData(
            RQ_KEY(data.pageId),
          ) as InfiniteData<IPagination<IComment>> | undefined;

          if (createCache && createCache.pages.length > 0) {
            const alreadyExists = createCache.pages.some((page) =>
              page.items.some((c) => c.id === data.comment.id),
            );
            if (alreadyExists) break;

            const lastIdx = createCache.pages.length - 1;
            queryClient.setQueryData(RQ_KEY(data.pageId), {
              ...createCache,
              pages: createCache.pages.map((page, i) =>
                i === lastIdx
                  ? { ...page, items: [...page.items, data.comment] }
                  : page,
              ),
            });
          }
          break;
        }
        case "commentUpdated":
        case "commentResolved": {
          const updateCache = queryClient.getQueryData(
            RQ_KEY(data.pageId),
          ) as InfiniteData<IPagination<IComment>> | undefined;

          if (updateCache) {
            queryClient.setQueryData(RQ_KEY(data.pageId), {
              ...updateCache,
              pages: updateCache.pages.map((page) => ({
                ...page,
                items: page.items.map((comment) =>
                  comment.id === data.comment.id ? data.comment : comment,
                ),
              })),
            });
          }
          break;
        }
        case "commentDeleted": {
          const deleteCache = queryClient.getQueryData(
            RQ_KEY(data.pageId),
          ) as InfiniteData<IPagination<IComment>> | undefined;

          if (deleteCache) {
            queryClient.setQueryData(RQ_KEY(data.pageId), {
              ...deleteCache,
              pages: deleteCache.pages.map((page) => ({
                ...page,
                items: page.items.filter(
                  (comment) => comment.id !== data.commentId,
                ),
              })),
            });
          }
          break;
        }
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
        case "updateOne": {
          entity = data.entity[0];
          const keyIds =
            entity === "pages" ? [data.payload.slugId, data.id] : [data.id];

          for (const keyId of keyIds) {
            if (!keyId) continue;
            const cached = queryClient.getQueryData<Record<string, unknown>>([
              ...data.entity,
              keyId,
            ]);
            if (cached) {
              queryClient.setQueryData([...data.entity, keyId], {
                ...cached,
                ...data.payload,
              });
            }
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
          break;
        }
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
        case "verificationUpdated":
          queryClient.invalidateQueries({
            queryKey: ["page-verification-info", data.pageId],
          });
          break;
      }
    });
  }, [queryClient, socket]);
};
