import { Helmet } from "react-helmet-async";
import { getAppName } from "@/lib/config.ts";
import SettingsTitle from "@/components/settings/settings-title.tsx";
import React from "react";
import useUserRole from "@/hooks/use-user-role.tsx";
import LicenseDetails from "@/ee/licence/components/license-details.tsx";
import ActivateLicenseForm from "@/ee/licence/components/activate-license-modal.tsx";
import InstallationDetails from '@/ee/licence/components/installation-details.tsx';

export default function License() {
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

      <InstallationDetails/>

      <LicenseDetails />
    </>
  );
}
