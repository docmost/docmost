import React from "react";
import { useSpaceQuery } from "@/features/space/queries/space-query.ts";
import { EditSpaceForm } from "@/features/space/components/edit-space-form.tsx";
import { Text } from "@mantine/core";

interface SpaceDetailsProps {
  spaceId: string;
}
export default function SpaceDetails({ spaceId }: SpaceDetailsProps) {
  const { data: space, isLoading } = useSpaceQuery(spaceId);

  return (
    <>
      {space && (
        <div>
          <Text my="md" fw={600}>
            Details
          </Text>
          <EditSpaceForm space={space} />
        </div>
      )}
    </>
  );
}
