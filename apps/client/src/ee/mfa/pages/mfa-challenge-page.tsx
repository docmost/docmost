import React from "react";
import { MfaChallenge } from "@/ee/mfa/components/mfa-challenge";
import { useMfaPageProtection } from "@/ee/mfa/hooks/use-mfa-page-protection";

export function MfaChallengePage() {
  const { isValid } = useMfaPageProtection();

  if (!isValid) {
    return null;
  }

  return <MfaChallenge />;
}
