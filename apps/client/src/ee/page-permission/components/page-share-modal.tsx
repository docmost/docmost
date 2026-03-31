import { useState } from "react";
import {
  Button,
  Indicator,
  Loader,
  Modal,
  Stack,
  Tabs,
  Text,
  Center,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconWorld, IconLock } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { extractPageSlugId } from "@/lib";
import { usePageQuery } from "@/features/page/queries/page-query";
import { usePageRestrictionInfoQuery } from "@/ee/page-permission/queries/page-permission-query";
import { PagePermissionTab } from "@/ee/page-permission";
import { PublishTab } from "./publish-tab";
import { useShareForPageQuery } from "@/features/share/queries/share-query";
import { useIsCloudEE } from "@/hooks/use-is-cloud-ee";
import { useAtom } from "jotai";
import { workspaceAtom } from "@/features/user/atoms/current-user-atom";
import { useSpaceQuery } from "@/features/space/queries/space-query";

type PageShareModalProps = {
  readOnly?: boolean;
};

export function PageShareModal({ readOnly }: PageShareModalProps) {
  const { t } = useTranslation();
  const { pageSlug, spaceSlug } = useParams();
  const pageSlugId = extractPageSlugId(pageSlug);
  const [opened, { open, close }] = useDisclosure(false);
  const isCloudEE = useIsCloudEE();
  const [activeTab, setActiveTab] = useState<string | null>(
    isCloudEE ? "access" : "publish",
  );

  const [workspace] = useAtom(workspaceAtom);
  const { data: space } = useSpaceQuery(spaceSlug);
  const workspaceSharingDisabled = workspace?.settings?.sharing?.disabled === true;
  const spaceSharingDisabled = space?.settings?.sharing?.disabled === true;

  const { data: page } = usePageQuery({ pageId: pageSlugId });
  const pageId = page?.id;
  const isRestricted = page?.permissions?.hasRestriction ?? false;

  const { data: share } = useShareForPageQuery(pageId);
  const isPubliclyShared = !!share;

  const { data: restrictionInfo, isLoading: restrictionLoading } =
    usePageRestrictionInfoQuery(opened && isCloudEE ? pageId : undefined);

  return (
    <>
      <Button
        style={{ border: "none" }}
        size="compact-sm"
        leftSection={
          isRestricted ? (
            <Indicator color="red" offset={5} withBorder>
              <IconLock size={20} stroke={1.5} />
            </Indicator>
          ) : isPubliclyShared ? (
            <Indicator color="green" offset={5} withBorder>
              <IconWorld size={20} stroke={1.5} />
            </Indicator>
          ) : null
        }
        variant="default"
        onClick={open}
      >
        {t("Share")}
      </Button>

      <Modal opened={opened} onClose={close} title={t("Share")} size={600}>
        <Tabs value={activeTab} color="dark" onChange={setActiveTab}>
          <Tabs.List mb="md">
            <Tabs.Tab value="access">{t("Access")}</Tabs.Tab>
            <Tabs.Tab
              value="publish"
              rightSection={
                isPubliclyShared ? (
                  <Indicator color="green" size={8} processing />
                ) : null
              }
            >
              {t("Publish")}
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="access">
            {!isCloudEE ? (
              <Stack align="center" py="md">
                <IconLock size={20} stroke={1.5} />
                <Text size="sm" ta="center" fw={500}>
                  {t("Page permissions")}
                </Text>
                <Text size="sm" c="dimmed" ta="center">
                  {t(
                    "Control who can view and edit individual pages. Available with an enterprise license.",
                  )}
                </Text>
              </Stack>
            ) : restrictionLoading || !pageId || !restrictionInfo ? (
              <Center py="xl">
                <Loader size="sm" />
              </Center>
            ) : (
              <PagePermissionTab
                pageId={pageId}
                restrictionInfo={restrictionInfo}
              />
            )}
          </Tabs.Panel>

          <Tabs.Panel value="publish">
            <PublishTab
              pageId={pageId}
              readOnly={readOnly}
              isRestricted={isRestricted}
              workspaceSharingDisabled={workspaceSharingDisabled}
              spaceSharingDisabled={spaceSharingDisabled}
            />
          </Tabs.Panel>
        </Tabs>
      </Modal>
    </>
  );
}
