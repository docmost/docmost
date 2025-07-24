import React from "react";
import { MfaChallenge } from "@/ee/mfa";
import { useMfaPageProtection } from "@/ee/mfa";

export function MfaChallengePage() {
  const { isValid } = useMfaPageProtection();

  if (!isValid) {
    return null;
  }

  return <MfaChallenge />;
}
