import { Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { OAuthGrantsTable } from "@/ee/oauth/components/oauth-grants-table";
import { useOAuthGrantsQuery } from "@/ee/oauth/queries/oauth-query";

export function AuthorizedAppsPanel() {
  const { t } = useTranslation();
  const { data, isLoading } = useOAuthGrantsQuery();

  return (
    <>
      <Text size="sm" c="dimmed" mb="md">
        {t("Applications and AI assistants you have authorized to access your account.")}
      </Text>

      <OAuthGrantsTable grants={data || []} isLoading={isLoading} />
    </>
  );
}
