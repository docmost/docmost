import {
  useBillingPlans,
  useBillingQuery,
} from "@/ee/billing/queries/billing-query.ts";
import { Group, Text, SimpleGrid, Paper } from "@mantine/core";
import classes from "./billing.module.css";
import { format } from "date-fns";
import { formatInterval } from "@/ee/billing/utils.ts";

export default function BillingDetails() {
  const { data: billing } = useBillingQuery();
  const { data: plans } = useBillingPlans();

  if (!billing || !plans) {
    return null;
  }

  return (
    <div className={classes.root}>
      <SimpleGrid cols={{ base: 1, xs: 2, sm: 3 }}>
        <Paper p="md" radius="md">
          <Group justify="apart">
            <div>
              <Text
                c="dimmed"
                tt="uppercase"
                fw={700}
                fz="xs"
                className={classes.label}
              >
                Plan
              </Text>
              <Text fw={700} fz="lg">
                {
                  plans.find(
                    (plan) => plan.productId === billing.stripeProductId,
                  )?.name
                }
              </Text>
            </div>
          </Group>
        </Paper>

        <Paper p="md" radius="md">
          <Group justify="apart">
            <div>
              <Text
                c="dimmed"
                tt="uppercase"
                fw={700}
                fz="xs"
                className={classes.label}
              >
                Billing Period
              </Text>
              <Text fw={700} fz="lg" tt="capitalize">
                {formatInterval(billing.interval)}
              </Text>
            </div>
          </Group>
        </Paper>

        <Paper p="md" radius="md">
          <Group justify="apart">
            <div>
              <Text
                c="dimmed"
                tt="uppercase"
                fw={700}
                fz="xs"
                className={classes.label}
              >
                {billing.cancelAtPeriodEnd
                  ? "Cancellation date"
                  : "Renewal date"}
              </Text>
              <Text fw={700} fz="lg">
                {format(billing.periodEndAt, "dd MMM, yyyy")}
              </Text>
            </div>
          </Group>
        </Paper>
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, xs: 2, sm: 3 }}>
        <Paper p="md" radius="md">
          <Group justify="apart">
            <div>
              <Text
                c="dimmed"
                tt="uppercase"
                fw={700}
                fz="xs"
                className={classes.label}
              >
                Seat count
              </Text>
              <Text fw={700} fz="lg">
                {billing.quantity}
              </Text>
            </div>
          </Group>
        </Paper>

        <Paper p="md" radius="md">
          <Group justify="apart">
            <div>
              <Text
                c="dimmed"
                tt="uppercase"
                fw={700}
                fz="xs"
                className={classes.label}
              >
                Total
              </Text>
              <Text fw={700} fz="lg">
                {(billing.amount / 100) * billing.quantity}{" "}
                {billing.currency.toUpperCase()}
              </Text>
              <Text c="dimmed" fz="sm">
                ${billing.amount / 100} /user/{billing.interval}
              </Text>
            </div>
          </Group>
        </Paper>
      </SimpleGrid>
    </div>
  );
}
