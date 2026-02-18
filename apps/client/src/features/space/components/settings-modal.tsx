import { Modal, Tabs, rem, Group, ScrollArea, Text } from "@mantine/core";
import SpaceMembersList from "@/features/space/components/space-members.tsx";
import AddSpaceMembersModal from "@/features/space/components/add-space-members-modal.tsx";
import React from "react";
import SpaceDetails from "@/features/space/components/space-details.tsx";
import { useSpaceQuery } from "@/features/space/queries/space-query.ts";
import { useSpaceAbility } from "@/features/space/permissions/use-space-ability.ts";
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from "@/features/space/permissions/permissions.type.ts";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
  const { data: space } = useSpaceQuery(spaceId);

  const spaceRules = space?.membership?.permissions;
  const spaceAbility = useSpaceAbility(spaceRules);

  return (
    <>
      <Modal.Root
        opened={opened}
        onClose={onClose}
        size={680}
        padding={0}
        yOffset="8vh"
        xOffset={0}
      >
        <Modal.Overlay blur={1} />
        <Modal.Content style={{ overflow: "hidden" }}>
          <Modal.Header py="xs">
            <Modal.Title>
              <Text fw={500} lineClamp={1}>
                {space?.name}
              </Text>
            </Modal.Title>
            <Modal.CloseButton />
          </Modal.Header>
          <Modal.Body p={0}>
            <div style={{ height: rem(560), maxHeight: "72vh", padding: rem(16) }}>
              <Tabs defaultValue="members">
                <Tabs.List>
                  <Tabs.Tab fw={500} value="general">
                    {t("Settings")}
                  </Tabs.Tab>
                  <Tabs.Tab fw={500} value="members">
                    {t("Members")}
                  </Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value="general" pt="md">
                  <ScrollArea h={"calc(72vh - 150px)"} scrollbarSize={6} pr={8}>
                    <div style={{ paddingBottom: rem(32) }}>
                      <SpaceDetails
                        spaceId={space?.id}
                        readOnly={spaceAbility.cannot(
                          SpaceCaslAction.Manage,
                          SpaceCaslSubject.Settings,
                        )}
                      />
                    </div>
                  </ScrollArea>
                </Tabs.Panel>

                <Tabs.Panel value="members" pt="md">
                  <Group my="md" justify="flex-end">
                    {spaceAbility.can(
                      SpaceCaslAction.Manage,
                      SpaceCaslSubject.Member,
                    ) && <AddSpaceMembersModal spaceId={space?.id} />}
                  </Group>

                  <SpaceMembersList
                    spaceId={space?.id}
                    readOnly={spaceAbility.cannot(
                      SpaceCaslAction.Manage,
                      SpaceCaslSubject.Member,
                    )}
                  />
                </Tabs.Panel>
              </Tabs>
            </div>
          </Modal.Body>
        </Modal.Content>
      </Modal.Root>
    </>
  );
}
