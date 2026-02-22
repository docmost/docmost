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

type PageShareModalProps = {
  readOnly?: boolean;
};

export function PageShareModal({ readOnly }: PageShareModalProps) {
  const { t } = useTranslation();
  const { pageSlug } = useParams();
  const pageSlugId = extractPageSlugId(pageSlug);
  const [opened, { open, close }] = useDisclosure(false);
  const [activeTab, setActiveTab] = useState<string | null>("share");

  const { data: page } = usePageQuery({ pageId: pageSlugId });
  const pageId = page?.id;
  const isRestricted = page?.permissions?.hasRestriction ?? false;

  const { data: restrictionInfo, isLoading: restrictionLoading } =
    usePageRestrictionInfoQuery(opened ? pageId : undefined);

  return (
    <>
      <Button
        style={{ border: "none" }}
        size="compact-sm"
        leftSection={
          <Indicator
            color={isRestricted ? "red" : "green"}
            offset={5}
            disabled={!page?.permissions}
            withBorder
          >
            {isRestricted ? (
              <IconLock size={20} stroke={1.5} />
            ) : (
              <IconWorld size={20} stroke={1.5} />
            )}
          </Indicator>
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
        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List mb="md">
            <Tabs.Tab value="share">{t("Share")}</Tabs.Tab>
            <Tabs.Tab value="publish">{t("Publish")}</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="share">
            {restrictionLoading || !pageId ? (
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
            <PublishTab pageId={pageId} readOnly={readOnly} />
          </Tabs.Panel>
        </Tabs>
      </Modal>
    </>
  );
}
