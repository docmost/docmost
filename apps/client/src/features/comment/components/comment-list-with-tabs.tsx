import React, { useState, useRef, useCallback, memo, useMemo } from "react";
import { useParams } from "react-router-dom";
import { Divider, Paper, Tabs, Badge, Text, ScrollArea } from "@mantine/core";
import CommentListItem from "@/features/comment/components/comment-list-item";
import {
  useCommentsQuery,
  useCreateCommentMutation,
} from "@/features/comment/queries/comment-query";
import CommentEditor from "@/features/comment/components/comment-editor";
import CommentActions from "@/features/comment/components/comment-actions";
import { useFocusWithin } from "@mantine/hooks";
import { IComment } from "@/features/comment/types/comment.types.ts";
import { usePageQuery } from "@/features/page/queries/page-query.ts";
import { IPagination } from "@/lib/types.ts";
import { extractPageSlugId } from "@/lib";
import { useTranslation } from "react-i18next";
import { useQueryEmit } from "@/features/websocket/use-query-emit";
import { useIsCloudEE } from "@/hooks/use-is-cloud-ee";
import { useGetSpaceBySlugQuery } from "@/features/space/queries/space-query.ts";
import { useSpaceAbility } from "@/features/space/permissions/use-space-ability.ts";
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from "@/features/space/permissions/permissions.type.ts";

function CommentListWithTabs() {
  const { t } = useTranslation();
  const { pageSlug } = useParams();
  const { data: page } = usePageQuery({ pageId: extractPageSlugId(pageSlug) });
  const {
    data: comments,
    isLoading: isCommentsLoading,
    isError,
  } = useCommentsQuery({ pageId: page?.id, limit: 100 });
  const createCommentMutation = useCreateCommentMutation();
  const [isLoading, setIsLoading] = useState(false);
  const emit = useQueryEmit();
  const isCloudEE = useIsCloudEE();
  const { data: space } = useGetSpaceBySlugQuery(page?.space?.slug);

  const spaceRules = space?.membership?.permissions;
  const spaceAbility = useSpaceAbility(spaceRules);


  const canComment: boolean = spaceAbility.can(
    SpaceCaslAction.Manage,
    SpaceCaslSubject.Page
  );

  // Separate active and resolved comments
  const { activeComments, resolvedComments } = useMemo(() => {
    if (!comments?.items) {
      return { activeComments: [], resolvedComments: [] };
    }

    const parentComments = comments.items.filter(
      (comment: IComment) => comment.parentCommentId === null
    );

    const active = parentComments.filter(
      (comment: IComment) => !comment.resolvedAt
    );
    const resolved = parentComments.filter(
      (comment: IComment) => comment.resolvedAt
    );

    return { activeComments: active, resolvedComments: resolved };
  }, [comments]);

  const handleAddReply = useCallback(
    async (commentId: string, content: string) => {
      try {
        setIsLoading(true);
        const commentData = {
          pageId: page?.id,
          parentCommentId: commentId,
          content: JSON.stringify(content),
        };

        await createCommentMutation.mutateAsync(commentData);

        emit({
          operation: "invalidateComment",
          pageId: page?.id,
        });
      } catch (error) {
        console.error("Failed to post comment:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [createCommentMutation, page?.id]
  );

  const renderComments = useCallback(
    (comment: IComment) => (
      <Paper
        shadow="sm"
        radius="md"
        p="sm"
        mb="sm"
        withBorder
        key={comment.id}
        data-comment-id={comment.id}
      >
        <div>
          <CommentListItem
            comment={comment}
            pageId={page?.id}
            canComment={canComment}
            userSpaceRole={space?.membership?.role}
          />
          <MemoizedChildComments
            comments={comments}
            parentId={comment.id}
            pageId={page?.id}
            canComment={canComment}
            userSpaceRole={space?.membership?.role}
          />
        </div>

        {!comment.resolvedAt && canComment && (
          <>
            <Divider my={4} />
            <CommentEditorWithActions
              commentId={comment.id}
              onSave={handleAddReply}
              isLoading={isLoading}
            />
          </>
        )}
      </Paper>
    ),
    [comments, handleAddReply, isLoading, space?.membership?.role]
  );

  if (isCommentsLoading) {
    return <></>;
  }

  if (isError) {
    return <div>{t("Error loading comments.")}</div>;
  }

  const totalComments = activeComments.length + resolvedComments.length;

  // If not cloud/enterprise, show simple list without tabs
  if (!isCloudEE) {
    if (totalComments === 0) {
      return <>{t("No comments yet.")}</>;
    }

    return (
      <ScrollArea style={{ height: "85vh" }} scrollbarSize={5} type="scroll">
        <div style={{ paddingBottom: "200px" }}>
          {comments?.items
            .filter((comment: IComment) => comment.parentCommentId === null)
            .map((comment) => (
              <Paper
                shadow="sm"
                radius="md"
                p="sm"
                mb="sm"
                withBorder
                key={comment.id}
                data-comment-id={comment.id}
              >
                <div>
                  <CommentListItem
                    comment={comment}
                    pageId={page?.id}
                    canComment={canComment}
                    userSpaceRole={space?.membership?.role}
                  />
                  <MemoizedChildComments
                    comments={comments}
                    parentId={comment.id}
                    pageId={page?.id}
                    canComment={canComment}
                    userSpaceRole={space?.membership?.role}
                  />
                </div>

                {canComment && (
                  <>
                    <Divider my={4} />
                    <CommentEditorWithActions
                      commentId={comment.id}
                      onSave={handleAddReply}
                      isLoading={isLoading}
                    />
                  </>
                )}
              </Paper>
            ))}
        </div>
      </ScrollArea>
    );
  }

  return (
    <div style={{ height: "85vh", display: "flex", flexDirection: "column", marginTop: '-15px' }}>
      <Tabs defaultValue="open" variant="default" style={{ flex: "0 0 auto" }}>
        <Tabs.List justify="center">
          <Tabs.Tab
            value="open"
            leftSection={
              <Badge size="sm" variant="light" color="blue">
                {activeComments.length}
              </Badge>
            }
          >
            {t("Open")}
          </Tabs.Tab>
          <Tabs.Tab
            value="resolved"
            leftSection={
              <Badge size="sm" variant="light" color="green">
                {resolvedComments.length}
              </Badge>
            }
          >
            {t("Resolved")}
          </Tabs.Tab>
        </Tabs.List>

        <ScrollArea
          style={{ flex: "1 1 auto", height: "calc(85vh - 60px)" }}
          scrollbarSize={5}
          type="scroll"
        >
          <div style={{ paddingBottom: "200px" }}>
            <Tabs.Panel value="open" pt="xs">
              {activeComments.length === 0 ? (
                <Text size="sm" c="dimmed" ta="center" py="md">
                  {t("No open comments.")}
                </Text>
              ) : (
                activeComments.map(renderComments)
              )}
            </Tabs.Panel>

            <Tabs.Panel value="resolved" pt="xs">
              {resolvedComments.length === 0 ? (
                <Text size="sm" c="dimmed" ta="center" py="md">
                  {t("No resolved comments.")}
                </Text>
              ) : (
                resolvedComments.map(renderComments)
              )}
            </Tabs.Panel>
          </div>
        </ScrollArea>
      </Tabs>
    </div>
  );
}

interface ChildCommentsProps {
  comments: IPagination<IComment>;
  parentId: string;
  pageId: string;
  canComment: boolean;
  userSpaceRole?: string;
}
const ChildComments = ({
  comments,
  parentId,
  pageId,
  canComment,
  userSpaceRole,
}: ChildCommentsProps) => {
  const getChildComments = useCallback(
    (parentId: string) =>
      comments.items.filter(
        (comment: IComment) => comment.parentCommentId === parentId
      ),
    [comments.items]
  );

  return (
    <div>
      {getChildComments(parentId).map((childComment) => (
        <div key={childComment.id}>
          <CommentListItem
            comment={childComment}
            pageId={pageId}
            canComment={canComment}
            userSpaceRole={userSpaceRole}
          />
          <MemoizedChildComments
            comments={comments}
            parentId={childComment.id}
            pageId={pageId}
            canComment={canComment}
            userSpaceRole={userSpaceRole}
          />
        </div>
      ))}
    </div>
  );
};

const MemoizedChildComments = memo(ChildComments);

const CommentEditorWithActions = ({ commentId, onSave, isLoading }) => {
  const [content, setContent] = useState("");
  const { ref, focused } = useFocusWithin();
  const commentEditorRef = useRef(null);

  const handleSave = useCallback(() => {
    onSave(commentId, content);
    setContent("");
    commentEditorRef.current?.clearContent();
  }, [commentId, content, onSave]);

  return (
    <div ref={ref}>
      <CommentEditor
        ref={commentEditorRef}
        onUpdate={setContent}
        onSave={handleSave}
        editable={true}
      />
      {focused && <CommentActions onSave={handleSave} isLoading={isLoading} />}
    </div>
  );
};

export default CommentListWithTabs;
