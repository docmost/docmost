import { Helmet } from "react-helmet-async";
import { getAppName } from "@/lib/config.ts";
import SettingsTitle from "@/components/settings/settings-title.tsx";
import React from "react";
import useUserRole from "@/hooks/use-user-role.tsx";
import { useTranslation } from "react-i18next";
import EnableAiSearch from "@/ee/ai/components/enable-ai-search.tsx";
import EnableGenerativeAi from "@/ee/ai/components/enable-generative-ai.tsx";
import McpSettings from "@/ee/ai/components/mcp-settings.tsx";
import { Alert, Stack, Tabs } from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";
import { useIsCloudEE } from "@/hooks/use-is-cloud-ee.tsx";
import { isCloud } from "@/lib/config.ts";
import { useLocation, useNavigate } from "react-router-dom";

export default function AiSettings() {
  const { t } = useTranslation();
  const { isAdmin } = useUserRole();
  const hasAccess = useIsCloudEE();
  const location = useLocation();
  const navigate = useNavigate();

  const activeTab = location.pathname.endsWith("/mcp") ? "mcp" : "ai";

  if (!isAdmin) {
    return null;
  }

  const handleTabChange = (value: string | null) => {
    if (value === "mcp") {
      navigate("/settings/ai/mcp");
    } else {
      navigate("/settings/ai");
    }
  };

  return (
    <>
      <Helmet>
        <title>AI - {getAppName()}</title>
      </Helmet>
      <SettingsTitle title={t("AI")} />

      <Tabs color="dark" value={activeTab} onChange={handleTabChange}>
        <Tabs.List>
          <Tabs.Tab fw={500} value="ai">
            {t("AI")}
          </Tabs.Tab>
          <Tabs.Tab fw={500} value="mcp">
            {t("MCP")}
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="ai" pt="md">
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

          <Stack gap="md">
            {!isCloud() && <EnableAiSearch />}
            <EnableGenerativeAi />
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="mcp" pt="md">
          <McpSettings />
        </Tabs.Panel>
      </Tabs>
    </>
  );
}
