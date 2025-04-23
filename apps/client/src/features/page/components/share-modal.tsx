import { Modal, rem, Group, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import {
  PageCaslAction,
  PageCaslSubject,
} from "../permissions/permissions.type";
import { usePageQuery } from "../queries/page-query";
import { usePageAbility } from "../permissions/use-page-ability";
import PageMembersList from "./page-members";
import AddPageMembersModal from "./add-page-members-modal";

interface PageShareModalParams {
  pageId: string;
  opened: boolean;
  onClose: () => void;
}

export default function PageShareModal({
  pageId,
  opened,
  onClose,
}: PageShareModalParams) {
  const { t } = useTranslation();
  const { data: page, isLoading } = usePageQuery({ pageId });

  const pageRules = page?.membership?.permissions;
  const pageAbility = usePageAbility(pageRules);

  const canManageMembers =
    page && pageAbility.can(PageCaslAction.Manage, PageCaslSubject.Member);

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
            <Modal.Title>
              <Text fw={500} lineClamp={1}>
                {`Share - ${page?.title}`}
              </Text>
            </Modal.Title>
            <Modal.CloseButton />
          </Modal.Header>
          <Modal.Body>
            <div style={{ height: rem(600) }}>
              <Group my="md" justify="flex-end">
                {canManageMembers && <AddPageMembersModal pageId={page?.id} />}
              </Group>
              <PageMembersList pageId={page?.id} readOnly={!canManageMembers} />
            </div>
          </Modal.Body>
        </Modal.Content>
      </Modal.Root>
    </>
  );
}
