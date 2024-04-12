import {
  Modal,
  Tabs,
  rem,
  Group,
  Divider,
  Text,
  ScrollArea,
} from "@mantine/core";
import SpaceMembersList from "@/features/space/components/space-members.tsx";
import AddSpaceMembersModal from "@/features/space/components/add-space-members-modal.tsx";
import React from "react";
import GroupActionMenu from "@/features/group/components/group-action-menu.tsx";
import { ISpace } from "@/features/space/types/space.types.ts";
import SpaceDetails from "@/features/space/components/space-details.tsx";
import { useSpaceQuery } from "@/features/space/queries/space-query.ts";

interface SpaceSettingsModalProps {
  spaceId: string;
  opened: boolean;
  onClose: () => void;
}

export default function SpaceSettingsModal({
  spaceId,
  opened,
  onClose,
}: SpaceSettingsModalProps) {
  const { data: space, isLoading } = useSpaceQuery(spaceId);

  return (
    <>
      <Modal.Root
        opened={opened}
        onClose={onClose}
        size={600}
        padding="xl"
        yOffset="10vh"
        xOffset={0}
        mah={400}
      >
        <Modal.Overlay />
        <Modal.Content style={{ overflow: "hidden" }}>
          <Modal.Header py={0}>
            <Modal.Title fw={500}>{space?.name} space </Modal.Title>
            <Modal.CloseButton />
          </Modal.Header>
          <Modal.Body>
            <div style={{ height: rem("600px") }}>
              <Tabs color="gray" defaultValue="members">
                <Tabs.List>
                  <Tabs.Tab fw={500} value="general">
                    Settings
                  </Tabs.Tab>
                  <Tabs.Tab fw={500} value="members">
                    Members
                  </Tabs.Tab>
                </Tabs.List>

                <ScrollArea h="600" w="100%" scrollbarSize={5}>
                  <Tabs.Panel value="general">
                    <SpaceDetails spaceId={space?.id} />
                    <Divider my="sm" />
                  </Tabs.Panel>

                  <Tabs.Panel value="members">
                    <Group my="md" justify="flex-end">
                      <AddSpaceMembersModal spaceId={space?.id} />
                      <GroupActionMenu />
                    </Group>

                    <SpaceMembersList spaceId={space?.id} />
                  </Tabs.Panel>
                </ScrollArea>
              </Tabs>
            </div>
          </Modal.Body>
        </Modal.Content>
      </Modal.Root>
    </>
  );
}
