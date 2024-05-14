import { useSpaceQuery } from "@/features/space/queries/space-query.ts";
import { useAtom } from "jotai/index";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom.ts";
import { Box } from "@mantine/core";
import { IconNotes } from "@tabler/icons-react";
import React from "react";
import SpaceTree from "@/features/page/tree/components/space-tree.tsx";
import { TreeCollapse } from "@/features/page/tree/components/tree-collapse.tsx";

export default function SpaceContent() {
  const [currentUser] = useAtom(currentUserAtom);
  const { data: space } = useSpaceQuery(currentUser?.workspace.defaultSpaceId);

  if (!space) {
    return <div>Loading...</div>;
  }

  return (
    <>
      <Box p="sm" mx="auto">
        <TreeCollapse
          initiallyOpened={true}
          icon={IconNotes}
          label={space.name}
        >
          <SpaceTree spaceId={space.id} />
        </TreeCollapse>
      </Box>
    </>
  );
}
