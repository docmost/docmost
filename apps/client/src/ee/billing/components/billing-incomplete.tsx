import { Alert } from "@mantine/core";
import React from "react";

export default function BillingIncomplete() {
  return (
    <>
      <Alert variant="light" color="blue">
        Your subscription is in an incomplete state. Please refresh this page if
        you recently made your payment.
      </Alert>
    </>
  );
}
