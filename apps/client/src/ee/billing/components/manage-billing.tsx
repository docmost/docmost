import { Button, Group, Text } from "@mantine/core";
import React from "react";
import { getBillingPortalLink } from "@/ee/billing/services/billing-service.ts";

export default function ManageBilling() {
  const handleBillingPortal = async () => {
    try {
      const portalLink = await getBillingPortalLink();
      window.location.href = portalLink.url;
    } catch (err) {
      console.error("Failed to get billing portal link", err);
    }
  };

  return (
    <>
      <Group justify="space-between" wrap="wrap" gap="xl">
        <div style={{ flex: 1, minWidth: "200px" }}>
          <Text size="md" fw={500}>
            Manage subscription
          </Text>
          <Text size="sm" c="dimmed">
            Manage your your subscription, invoices, update payment details, and
            more.
          </Text>
        </div>

        <Button style={{ flexShrink: 0 }} onClick={handleBillingPortal}>
          Manage
        </Button>
      </Group>
    </>
  );
}
