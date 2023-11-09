import { Divider, Paper, ScrollArea } from '@mantine/core';
import CommentEditor from '@/features/comment/components/comment-editor';
import CommentActions from '@/features/comment/components/comment-actions';
import React, { useState } from 'react';
import CommentListItem from '@/features/comment/components/comment-list-item';
import { IComment } from '@/features/comment/types/comment.types';
import useComment from '@/features/comment/hooks/use-comment';
import { useAtom } from 'jotai';
import { commentsAtom } from '@/features/comment/atoms/comment-atom';
import { useParams } from 'react-router-dom';
import { useFocusWithin } from '@mantine/hooks';

function CommentList({ comments }: IComment[]) {
  const { createCommentMutation } = useComment();
  const { isLoading } = createCommentMutation;
  const { pageId } = useParams();
  const [, setCommentsAtom] = useAtom(commentsAtom(pageId));

  const getChildComments = (parentId) => {
    return comments.filter(comment => comment.parentCommentId === parentId);
  };

  const renderChildComments = (parentId) => {
    const children = getChildComments(parentId);
    return (
      <div>
        {children.map(childComment => (
          <div key={childComment.id}>
            <CommentListItem comment={childComment} />
            {renderChildComments(childComment.id)}
          </div>
        ))}
      </div>
    );
  };

  const CommentEditorWithActions = ({ commentId, onSave, isLoading }) => {
    const [content, setContent] = useState('');
    const { ref, focused } = useFocusWithin();

    const handleSave = () => {
      onSave(commentId, content);
      setContent('');
    };

    return (
      <div ref={ref}>
        <CommentEditor onUpdate={setContent} editable={true} />

        {focused && <CommentActions onSave={handleSave} isLoading={isLoading} />}
      </div>
    );
  };

  const renderComments = (comment) => {
    const handleAddReply = async (commentId, content) => {
      const commentData = {
        pageId: comment.pageId,
        parentCommentId: comment.id,
        content: JSON.stringify(content),
      };

      const createdComment = await createCommentMutation.mutateAsync(commentData);
      setCommentsAtom(prevComments => [...prevComments, createdComment]);
    };

    return (
      <Paper shadow="sm" radius="md" p="sm" mb="sm" withBorder
             key={comment.id} data-comment-id={comment.id}
      >
        <div>
          <CommentListItem comment={comment} />
          {renderChildComments(comment.id)}
        </div>

        <Divider my={4} />

        <CommentEditorWithActions onSave={handleAddReply} isLoading={isLoading} />

      </Paper>
    );
  };

  return (
    <ScrollArea style={{ height: '85vh' }} scrollbarSize={4} type="scroll">
      <div style={{ paddingBottom: '200px' }}>
        {comments
          .filter(comment => comment.parentCommentId === null)
          .map(comment => renderComments(comment))
        }
      </div>
    </ScrollArea>
  );
}

export default CommentList;
