import { Divider, Paper, ScrollArea } from '@mantine/core';
import CommentEditor from '@/features/comment/components/comment-editor';
import CommentActions from '@/features/comment/components/comment-actions';
import React, { useState } from 'react';
import CommentListItem from '@/features/comment/components/comment-list-item';
import { IComment } from '@/features/comment/types/comment.types';
import { useFocusWithin } from '@mantine/hooks';
import { useCreateCommentMutation } from '@/features/comment/queries/comment';

interface CommentListProps {
  comments: IComment[];
}

function CommentList({ comments }: CommentListProps) {
  const createCommentMutation = useCreateCommentMutation();
  const [isLoading, setIsLoading] = useState<boolean>(false);

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
      try {
        setIsLoading(true);
        const commentData = {
          pageId: comment.pageId,
          parentCommentId: comment.id,
          content: JSON.stringify(content),
        };

        await createCommentMutation.mutateAsync(commentData);
      } catch (error) {
        console.error('Failed to add reply:', error);
      } finally {
        setIsLoading(false);
      }

      //setCommentsAtom(prevComments => [...prevComments, createdComment]);
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
