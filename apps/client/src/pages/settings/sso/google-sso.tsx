import { Divider, Group } from "@mantine/core";
import { useTranslation } from "react-i18next";
import SettingsTitle from "@/components/settings/settings-title.tsx";
import { DocumentTitle } from "@/components/ui/document-title.tsx";
import useUserRole from "@/hooks/use-user-role.tsx";
import GoogleSsoSettings from "@/features/sso/components/google-sso-settings.tsx";
import GroupMappingTable from "@/features/sso/components/group-mapping-table.tsx";
import GroupMappingWizard from "@/features/sso/components/group-mapping-wizard.tsx";

export default function GoogleSso() {
  const { t } = useTranslation();
  const { isAdmin } = useUserRole();

  if (!isAdmin) {
    return null;
  }

  return (
    <>
      <DocumentTitle title={t("Google SSO")} />
      <SettingsTitle title={t("Google SSO")} />

      <GoogleSsoSettings />

      <Divider my="lg" />

      <Group justify="flex-end" mb="sm">
        <GroupMappingWizard />
      </Group>

      <GroupMappingTable />
    </>
  );
}
