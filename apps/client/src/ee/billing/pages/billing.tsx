import SettingsTitle from "@/components/settings/settings-title.tsx";
import BillingPlans from "@/ee/billing/components/billing-plans.tsx";
import BillingTrial from "@/ee/billing/components/billing-trial.tsx";
import ManageBilling from "@/ee/billing/components/manage-billing.tsx";
import { Divider } from "@mantine/core";
import React from "react";
import BillingDetails from "@/ee/billing/components/billing-details.tsx";
import { useBillingQuery } from "@/ee/billing/queries/billing-query.ts";
import useUserRole from "@/hooks/use-user-role.tsx";
import { DocumentTitle } from "@/components/ui/document-title.tsx";

export default function Billing() {
  const { data: billing, isError: isBillingError } = useBillingQuery();
  const { isAdmin } = useUserRole();

  if (!isAdmin) {
    return null;
  }

  return (
    <>
      <DocumentTitle title="Billing" />
      <SettingsTitle title="Billing" />

      <BillingTrial />
      <BillingDetails />

      {isBillingError && <BillingPlans />}

      {billing && (
        <>
          <Divider my="lg" />
          <ManageBilling />
        </>
      )}
    </>
  );
}
