import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import {
  Button,
  Divider,
  Group,
  Paper,
  Stack,
  Text,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import SettingsTitle from "@/components/settings/settings-title";
import { ConfluenceIcon } from "@/components/icons/confluence-icon";
import ConfluenceImportModal from "@/ee/confluence-import/components/confluence-import-modal";
import ConfluenceImportHistory from "@/ee/confluence-import/components/confluence-import-history";
import { getAppName } from "@/lib/config";
import { useHasFeature } from "@/ee/hooks/use-feature";
import { Feature } from "@/ee/features";
import { useUpgradeLabel } from "@/ee/hooks/use-upgrade-label";

export default function ConfluenceImportPage() {
  const { t } = useTranslation();
  const [opened, { open, close }] = useDisclosure(false);
  const hasConfluenceImport = useHasFeature(Feature.CONFLUENCE_API_IMPORT);
  const upgradeLabel = useUpgradeLabel();

  return (
    <>
      <Helmet>
        <title>
          {t("Import from Confluence")} - {getAppName()}
        </title>
      </Helmet>

      <SettingsTitle title={t("Import from Confluence")} />

      <Paper withBorder p="lg" radius="md" mb="lg">
        <Group align="flex-start" justify="space-between" wrap="nowrap">
          <Group align="flex-start" wrap="nowrap">
            <ConfluenceIcon size={32} />
            <Stack gap={4}>
              <Text fw={600}>{t("Confluence API import")}</Text>
              <Text size="sm" c="dimmed" maw={560}>
                {t(
                  "Connect to Confluence Cloud or Data Center to import spaces, pages, attachments, comments, users, groups and permissions directly via the API.",
                )}
              </Text>
            </Stack>
          </Group>

          <Tooltip label={upgradeLabel} disabled={hasConfluenceImport}>
            <Button onClick={open} disabled={!hasConfluenceImport}>
              {t("Start import")}
            </Button>
          </Tooltip>
        </Group>
      </Paper>

      <Divider my="md" label={t("Import history")} labelPosition="left" />

      <ConfluenceImportHistory />

      <ConfluenceImportModal opened={opened} onClose={close} />
    </>
  );
}
