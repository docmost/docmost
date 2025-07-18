import React from "react";
import { isCloud } from "@/lib/config";
import { useLicense } from "@/ee/hooks/use-license";
import { MfaSettings } from "@/ee/mfa";

export function AccountMfaSection() {
  const { hasLicenseKey } = useLicense();
  const showMfa = isCloud() || hasLicenseKey;

  if (!showMfa) {
    return null;
  }

  return <MfaSettings />;
}
