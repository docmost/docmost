import React from 'react';
import { useSpaceQuery } from '@/features/space/queries/space-query.ts';
import { EditSpaceForm } from '@/features/space/components/edit-space-form.tsx';
import { Divider, Group, Text } from '@mantine/core';
import DeleteSpaceModal from './delete-space-modal';

interface SpaceDetailsProps {
  spaceId: string;
  readOnly?: boolean;
}
export default function SpaceDetails({ spaceId, readOnly }: SpaceDetailsProps) {
  const { data: space, isLoading } = useSpaceQuery(spaceId);

  return (
    <>
      {space && (
        <div>
          <Text my="md" fw={600}>
            Details
          </Text>
          <EditSpaceForm space={space} readOnly={readOnly} />

          {!readOnly && (
            <>
              <Divider my="lg" />

              <Group justify="space-between" wrap="nowrap" gap="xl">
                <div>
                  <Text size="md">Delete space</Text>
                  <Text size="sm" c="dimmed">
                    Delete this space with all its pages and data.
                  </Text>
                </div>

                <DeleteSpaceModal space={space} />
              </Group>
            </>
          )}
        </div>
      )}
    </>
  );
}
