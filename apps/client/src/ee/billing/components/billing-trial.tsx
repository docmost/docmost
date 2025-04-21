import { Alert } from "@mantine/core";
import { useBillingQuery } from "@/ee/billing/queries/billing-query.ts";
import useTrial from "@/ee/hooks/use-trial.tsx";

export default function BillingTrial() {
  const { data: billing, isLoading } = useBillingQuery();
  const { trialDaysLeft } = useTrial();

  if (isLoading) {
    return null;
  }

  return (
    <>
      {trialDaysLeft > 0 && !billing && (
        <Alert title="Your Trial is Active 🎉" color="blue" radius="md">
          You have {trialDaysLeft} {trialDaysLeft === 1 ? "day" : "days"} left
          in your 7-day trial. Please subscribe to a plan before your trial
          ends.
        </Alert>
      )}

      {trialDaysLeft === 0 && (
        <Alert title="Your Trial has ended" color="red" radius="md">
          Your 7-day trial has come to an end. Please subscribe to a plan to
          continue using this service.
        </Alert>
      )}
    </>
  );
}
