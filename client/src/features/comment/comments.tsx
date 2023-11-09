import { useParams } from 'react-router-dom';
import { useAtom } from 'jotai';
import { commentsAtom } from '@/features/comment/atoms/comment-atom';
import React, { useEffect } from 'react';
import { getPageComments } from '@/features/comment/services/comment-service';
import classes from '@/features/comment/components/comment.module.css';
import { Text } from '@mantine/core';
import CommentList from '@/features/comment/components/comment-list';

export default function Comments() {
  const { pageId } = useParams();
  const [comments, setComments] = useAtom(commentsAtom(pageId));

  useEffect(() => {
    const fetchComments = async () => {
      try {
        const response = await getPageComments(pageId);
        setComments(response);
      } catch (error) {
        console.error('Failed to fetch comments:', error);
      }
    };

    fetchComments();
  }, [pageId]);

  return (
    <div className={classes.wrapper}>
      <Text mb="md" fw={500}>Comments</Text>

      <CommentList comments={comments} />
    </div>
  );
}
