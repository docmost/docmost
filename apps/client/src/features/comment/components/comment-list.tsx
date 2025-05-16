import React, { useState, useRef, useCallback, memo } from "react";
import { useParams } from "react-router-dom";
import { Divider, Paper } from "@mantine/core";
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

function CommentList() {
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
    [createCommentMutation, page?.id],
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
          <CommentListItem comment={comment} pageId={page?.id} />
          <MemoizedChildComments comments={comments} parentId={comment.id} pageId={page?.id} />
        </div>

        <Divider my={4} />

        <CommentEditorWithActions
          commentId={comment.id}
          onSave={handleAddReply}
          isLoading={isLoading}
        />
      </Paper>
    ),
    [comments, handleAddReply, isLoading],
  );

  if (isCommentsLoading) {
    return <></>;
  }

  if (isError) {
    return <div>{t("Error loading comments.")}</div>;
  }

  if (!comments || comments.items.length === 0) {
    return <>{t("No comments yet.")}</>;
  }

  return (
    <>
      {comments.items
        .filter((comment) => comment.parentCommentId === null)
        .map(renderComments)}
    </>
  );
}

interface ChildCommentsProps {
  comments: IPagination<IComment>;
  parentId: string;
  pageId: string;
}
const ChildComments = ({ comments, parentId, pageId }: ChildCommentsProps) => {
  const getChildComments = useCallback(
    (parentId: string) =>
      comments.items.filter(
        (comment: IComment) => comment.parentCommentId === parentId,
      ),
    [comments.items],
  );

  return (
    <div>
      {getChildComments(parentId).map((childComment) => (
        <div key={childComment.id}>
          <CommentListItem comment={childComment} pageId={pageId} />
          <MemoizedChildComments
            comments={comments}
            parentId={childComment.id}
            pageId={pageId}
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

export default CommentList;
