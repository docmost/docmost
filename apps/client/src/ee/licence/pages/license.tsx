import { Helmet } from "react-helmet-async";
import { getAppName } from "@/lib/config.ts";
import SettingsTitle from "@/components/settings/settings-title.tsx";
import React from "react";
import useUserRole from "@/hooks/use-user-role.tsx";
import LicenseDetails from "@/ee/licence/components/license-details.tsx";
import ActivateLicenseForm from "@/ee/licence/components/activate-license-modal.tsx";
import InstallationDetails from "@/ee/licence/components/installation-details.tsx";
import OssDetails from "@/ee/licence/components/oss-details.tsx";
import { useAtom } from "jotai/index";
import { workspaceAtom } from "@/features/user/atoms/current-user-atom.ts";

export default function License() {
  const [workspace] = useAtom(workspaceAtom);
  const { isAdmin } = useUserRole();

  if (!isAdmin) {
    return null;
  }

  return (
    <>
      <Helmet>
        <title>License - {getAppName()}</title>
      </Helmet>
      <SettingsTitle title="License" />

      <ActivateLicenseForm />

      <InstallationDetails />

      {workspace?.hasLicenseKey ? <LicenseDetails /> : <OssDetails />}
    </>
  );
}
