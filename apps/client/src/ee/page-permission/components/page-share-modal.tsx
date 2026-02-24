import { useState } from "react";
import {
  Button,
  Indicator,
  Loader,
  Modal,
  Tabs,
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

type PageShareModalProps = {
  readOnly?: boolean;
};

export function PageShareModal({ readOnly }: PageShareModalProps) {
  const { t } = useTranslation();
  const { pageSlug } = useParams();
  const pageSlugId = extractPageSlugId(pageSlug);
  const [opened, { open, close }] = useDisclosure(false);
  const [activeTab, setActiveTab] = useState<string | null>("access");

  const { data: page } = usePageQuery({ pageId: pageSlugId });
  const pageId = page?.id;
  const isRestricted = page?.permissions?.hasRestriction ?? false;

  const { data: share } = useShareForPageQuery(pageId);
  const isPubliclyShared = !!share;

  const { data: restrictionInfo, isLoading: restrictionLoading } =
    usePageRestrictionInfoQuery(opened ? pageId : undefined);

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

      <Modal
        opened={opened}
        onClose={close}
        title={t("Share")}
        size={600}
      >
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
            {restrictionLoading || !pageId || !restrictionInfo ? (
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
            <PublishTab pageId={pageId} readOnly={readOnly} isRestricted={isRestricted} />
          </Tabs.Panel>
        </Tabs>
      </Modal>
    </>
  );
}
