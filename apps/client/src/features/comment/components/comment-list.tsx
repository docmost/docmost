import React, { useState, useRef } from "react";
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

function CommentList() {
  const { pageId } = useParams();
  const {
    data: comments,
    isLoading: isCommentsLoading,
    isError,
  } = useCommentsQuery({ pageId, limit: 100 });
  const [isLoading, setIsLoading] = useState(false);
  const createCommentMutation = useCreateCommentMutation();

  if (isCommentsLoading) {
    return <></>;
  }

  if (isError) {
    return <div>Error loading comments.</div>;
  }

  if (!comments || comments.items.length === 0) {
    return <>No comments yet.</>;
  }

  const renderComments = (comment: IComment) => {
    const handleAddReply = async (commentId: string, content: string) => {
      try {
        setIsLoading(true);
        const commentData = {
          pageId: comment.pageId,
          parentCommentId: comment.id,
          content: JSON.stringify(content),
        };

        await createCommentMutation.mutateAsync(commentData);
      } catch (error) {
        console.error("Failed to post comment:", error);
      } finally {
        setIsLoading(false);
      }
    };

    return (
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
          <CommentListItem comment={comment} />
          <ChildComments comments={comments} parentId={comment.id} />
        </div>

        <Divider my={4} />

        <CommentEditorWithActions
          commentId={comment.id}
          onSave={handleAddReply}
          isLoading={isLoading}
        />
      </Paper>
    );
  };

  return (
    <>
      {comments.items
        .filter((comment) => comment.parentCommentId === null)
        .map(renderComments)}
    </>
  );
}

const ChildComments = ({ comments, parentId }) => {
  const getChildComments = (parentId: string) => {
    return comments.items.filter(
      (comment: IComment) => comment.parentCommentId === parentId,
    );
  };

  return (
    <div>
      {getChildComments(parentId).map((childComment) => (
        <div key={childComment.id}>
          <CommentListItem comment={childComment} />
          <ChildComments comments={comments} parentId={childComment.id} />
        </div>
      ))}
    </div>
  );
};

const CommentEditorWithActions = ({ commentId, onSave, isLoading }) => {
  const [content, setContent] = useState("");
  const { ref, focused } = useFocusWithin();
  const commentEditorRef = useRef(null);

  const handleSave = () => {
    onSave(commentId, content);
    setContent("");
    commentEditorRef.current?.clearContent();
  };

  return (
    <div ref={ref}>
      <CommentEditor
        ref={commentEditorRef}
        onUpdate={setContent}
        editable={true}
      />
      {focused && <CommentActions onSave={handleSave} isLoading={isLoading} />}
    </div>
  );
};

export default CommentList;
