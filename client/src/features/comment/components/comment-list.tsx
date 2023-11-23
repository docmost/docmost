import React, { useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Divider, Paper } from '@mantine/core';
import CommentListItem from '@/features/comment/components/comment-list-item';
import { useCommentsQuery, useCreateCommentMutation } from '@/features/comment/queries/comment-query';

import CommentEditor from '@/features/comment/components/comment-editor';
import CommentActions from '@/features/comment/components/comment-actions';
import { useFocusWithin } from '@mantine/hooks';

function CommentList() {
  const { pageId } = useParams();
  const { data: comments, isLoading: isCommentsLoading, isError } = useCommentsQuery(pageId);
  const [isLoading, setIsLoading] = useState(false);
  const createCommentMutation = useCreateCommentMutation();

  if (isCommentsLoading) {
    return <></>;
  }

  if (isError) {
    return <div>Error loading comments.</div>;
  }

  if (!comments || comments.length === 0) {
    return <>No comments yet.</>;
  }

  const renderComments = (comment) => {
    const handleAddReply = async (commentId, content) => {
      try {
        setIsLoading(true);
        const commentData = {
          pageId: comment.pageId,
          parentCommentId: comment.id,
          content: JSON.stringify(content),
        };

        await createCommentMutation.mutateAsync(commentData);
      } catch (error) {
        console.error('Failed to post comment:', error);
      } finally {
        setIsLoading(false);
      }
    };

    return (
      <Paper shadow="sm" radius="md" p="sm" mb="sm" withBorder key={comment.id} data-comment-id={comment.id}>
        <div>
          <CommentListItem comment={comment} />
          <ChildComments comments={comments} parentId={comment.id} />
        </div>

        <Divider my={4} />

        <CommentEditorWithActions commentId={comment.id} onSave={handleAddReply} isLoading={isLoading} />
      </Paper>
    );
  };

  return (
    <>
      {comments.filter(comment => comment.parentCommentId === null).map(renderComments)}
    </>
  );
}

const ChildComments = ({ comments, parentId }) => {
  const getChildComments = (parentId) => {
    return comments.filter(comment => comment.parentCommentId === parentId);
  };

  return (
    <div>
      {getChildComments(parentId).map(childComment => (
        <div key={childComment.id}>
          <CommentListItem comment={childComment} />
          <ChildComments comments={comments} parentId={childComment.id} />
        </div>
      ))}
    </div>
  );
};

const CommentEditorWithActions = ({ commentId, onSave, isLoading }) => {
  const [content, setContent] = useState('');
  const { ref, focused } = useFocusWithin();
  const commentEditorRef = useRef(null);

  const handleSave = () => {
    onSave(commentId, content);
    setContent('');
    commentEditorRef.current?.clearContent();
  };

  return (
    <div ref={ref}>
      <CommentEditor ref={commentEditorRef} onUpdate={setContent} editable={true} />
      {focused && <CommentActions onSave={handleSave} isLoading={isLoading} />}
    </div>
  );
};


export default CommentList;
