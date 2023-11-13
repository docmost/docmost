import { useParams } from 'react-router-dom';
import React from 'react';
import classes from '@/features/comment/components/comment.module.css';
import { Text } from '@mantine/core';
import CommentList from '@/features/comment/components/comment-list';
import { useCommentsQuery } from '@/features/comment/queries/comment';

export default function Comments() {
  const { pageId } = useParams();
  const { data, isLoading, isError } = useCommentsQuery(pageId);

  if (isLoading) {
    return <></>;
  }

  return (
    <div className={classes.wrapper}>
      <Text mb="md" fw={500}>Comments</Text>
      {data ? <CommentList comments={data} /> : 'No comments yet'}
    </div>
  );
}
