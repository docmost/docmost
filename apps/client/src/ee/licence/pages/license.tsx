import SettingsTitle from "@/components/settings/settings-title.tsx";
import ActivateLicenseForm from "@/ee/licence/components/activate-license-modal.tsx";
import InstallationDetails from "@/ee/licence/components/installation-details.tsx";
import LicenseDetails from "@/ee/licence/components/license-details.tsx";
import OssDetails from "@/ee/licence/components/oss-details.tsx";
import { workspaceAtom } from "@/features/user/atoms/current-user-atom.ts";
import useUserRole from "@/hooks/use-user-role.tsx";
import { getAppName } from "@/lib/config.ts";
import { useAtom } from "jotai/index";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";

export default function License() {
  const [workspace] = useAtom(workspaceAtom);
  const { isAdmin } = useUserRole();
  const { t } = useTranslation();

  if (!isAdmin) {
    return null;
  }

  return (
    <>
      <Helmet>
        <title>License - {getAppName()}</title>
      </Helmet>
      <SettingsTitle title={t("License")} />

      <ActivateLicenseForm />

      <InstallationDetails />

      {workspace?.hasLicenseKey ? <LicenseDetails /> : <OssDetails />}
    </>
  );
}
