import SettingsTitle from "@/components/settings/settings-title.tsx";
import GroupMembersList from "@/features/group/components/group-members";
import GroupDetails from "@/features/group/components/group-details";
import { getAppName } from "@/lib/config.ts";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";

export default function GroupInfo() {
  const { t } = useTranslation();

  return (
    <>
      <Helmet>
        <title>
          {t("Manage Group")} - {getAppName()}
        </title>
      </Helmet>
      <SettingsTitle title={t("Manage Group")} />
      <GroupDetails />
      <GroupMembersList />
    </>
  );
}
