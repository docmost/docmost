import { useSpaceQuery } from "@/features/space/queries/space-query.ts";
import { useAtom } from "jotai/index";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom.ts";
import {
  Accordion,
  AccordionControlProps,
  ActionIcon,
  Center,
  rem,
  Tooltip,
} from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import React from "react";
import { treeApiAtom } from "@/features/page/tree/atoms/tree-api-atom.ts";
import SpaceTree from "@/features/page/tree/components/space-tree.tsx";

export default function SpaceContent() {
  const [currentUser] = useAtom(currentUserAtom);
  const { data: space } = useSpaceQuery(currentUser?.workspace.defaultSpaceId);

  if (!space) {
    return <div>Loading...</div>;
  }

  return (
    <>
      <Accordion
        chevronPosition="left"
        maw={400}
        mx="auto"
        defaultValue={space.id}
      >
        <Accordion.Item key={space.id} value={space.id}>
          <AccordionControl>{space.name}</AccordionControl>
          <Accordion.Panel>
            <SpaceTree spaceId={space.id} />
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </>
  );
}

function AccordionControl(props: AccordionControlProps) {
  const [tree] = useAtom(treeApiAtom);

  function handleCreatePage() {
    //todo: create at the bottom
    tree?.create({ parentId: null, type: "internal", index: 0 });
  }

  return (
    <Center>
      <Accordion.Control {...props} />
      {/* <ActionIcon size="lg" variant="subtle" color="gray">
        <IconDots size="1rem" />
      </ActionIcon> */}
      <Tooltip label="Create page" withArrow position="right">
        <ActionIcon variant="default" size={18} onClick={handleCreatePage}>
          <IconPlus style={{ width: rem(12), height: rem(12) }} stroke={1.5} />
        </ActionIcon>
      </Tooltip>
    </Center>
  );
}
