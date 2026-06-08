import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { getAppName } from "@/lib/config.ts";
import SettingsTitle from "@/components/settings/settings-title.tsx";
import IntegrationsList from "@/features/integrations/components/integrations-list";
import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { notifications } from "@mantine/notifications";

export default function AccountIntegrations() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  // Surface OAuth callback outcomes — controllers redirect back here on
  // both success and error.
  useEffect(() => {
    const connected = searchParams.get("connected");
    const error = searchParams.get("error");
    if (connected === "true") {
      notifications.show({
        message: t("Integration connected"),
        color: "green",
      });
    } else if (error) {
      notifications.show({
        message: t("Connection failed: ") + error,
        color: "red",
      });
    }
    if (connected || error) {
      const next = new URLSearchParams(searchParams);
      next.delete("connected");
      next.delete("error");
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <Helmet>
        <title>
          {t("Integrations")} - {getAppName()}
        </title>
      </Helmet>
      <SettingsTitle title={t("Integrations")} />
      <IntegrationsList />
    </>
  );
}
