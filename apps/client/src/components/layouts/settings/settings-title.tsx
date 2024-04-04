import React from 'react';
import { Divider, Title } from '@mantine/core';

export default function SettingsTitle({ title }: { title: string }) {
  return (
    <>
      <Title order={3}>
        {title}
      </Title>
      <Divider my="md" />
    </>
  );
}
