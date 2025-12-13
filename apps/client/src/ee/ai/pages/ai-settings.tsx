import { Helmet } from "react-helmet-async";
import { getAppName, isCloud } from "@/lib/config.ts";
import SettingsTitle from "@/components/settings/settings-title.tsx";
import React from "react";
import useUserRole from "@/hooks/use-user-role.tsx";
import { useTranslation } from "react-i18next";
import useLicense from "@/ee/hooks/use-license.tsx";
import EnableAiSearch from "@/ee/ai/components/enable-ai-search.tsx";
import { Alert } from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";

export default function AiSettings() {
  const { t } = useTranslation();
  const { isAdmin } = useUserRole();
  const { hasLicenseKey } = useLicense();

  if (!isAdmin) {
    return null;
  }

  const hasAccess = isCloud() || (!isCloud() && hasLicenseKey);

  return (
    <>
      <Helmet>
        <title>AI - {getAppName()}</title>
      </Helmet>
      <SettingsTitle title={t("AI settings")} />

      {!hasAccess && (
        <Alert
          icon={<IconInfoCircle />}
          title={t("Enterprise feature")}
          color="blue"
          mb="lg"
        >
          {t(
            "AI is only available in the Docmost enterprise edition. Contact sales@docmost.com.",
          )}
        </Alert>
      )}

      <EnableAiSearch />
    </>
  );
}
