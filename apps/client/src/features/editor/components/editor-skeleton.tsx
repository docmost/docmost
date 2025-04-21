import React, { useState, useEffect } from 'react';
import { Skeleton } from '@mantine/core';

function EditorSkeleton() {
  const [showSkeleton, setShowSkeleton] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowSkeleton(true), 100);
    return () => clearTimeout(timer);
  }, []);

  if (!showSkeleton) {
    return null;
  }

  return (
    <>
      <Skeleton height={12} mt={6} radius="xl" />
      <Skeleton height={12} mt={6} radius="xl" />
      <Skeleton height={12} mt={6} radius="xl" />
      <Skeleton height={12} mt={6} radius="xl" />
      <Skeleton height={12} mt={6} radius="xl" />
      <Skeleton height={12} mt={6} radius="xl" />
      <Skeleton height={12} mt={6} radius="xl" />
      <Skeleton height={12} mt={6} radius="xl" />
      <Skeleton height={12} mt={6} radius="xl" />
      <Skeleton height={12} mt={6} radius="xl" />
      <Skeleton height={12} mt={6} radius="xl" />
      <Skeleton height={12} mt={6} radius="xl" />
      <Skeleton height={12} mt={6} radius="xl" />
      <Skeleton height={12} mt={6} radius="xl" />
      <Skeleton height={12} mt={6} radius="xl" />
      <Skeleton height={12} mt={6} radius="xl" />
    </>

  );
}

export default EditorSkeleton;
