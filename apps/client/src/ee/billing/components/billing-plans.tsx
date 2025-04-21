import {
  Button,
  Card,
  List,
  SegmentedControl,
  ThemeIcon,
  Title,
  Text,
  Group,
} from "@mantine/core";
import { useState } from "react";
import { IconCheck } from "@tabler/icons-react";
import { useBillingPlans } from "@/ee/billing/queries/billing-query.ts";
import { getCheckoutLink } from "@/ee/billing/services/billing-service.ts";

export default function BillingPlans() {
  const { data: plans } = useBillingPlans();
  const [interval, setInterval] = useState("yearly");

  if (!plans) {
    return null;
  }

  const handleCheckout = async (priceId: string) => {
    try {
      const checkoutLink = await getCheckoutLink({
        priceId: priceId,
      });
      window.location.href = checkoutLink.url;
    } catch (err) {
      console.error("Failed to get checkout link", err);
    }
  };

  return (
    <Group justify="center" p="xl">
      {plans.map((plan) => {
        const price =
          interval === "monthly" ? plan.price.monthly : plan.price.yearly;
        const priceId = interval === "monthly" ? plan.monthlyId : plan.yearlyId;
        const yearlyMonthPrice = parseInt(plan.price.yearly) / 12;

        return (
          <Card
            key={plan.name}
            withBorder
            radius="md"
            shadow="sm"
            p="xl"
            w={300}
          >
            <SegmentedControl
              value={interval}
              onChange={setInterval}
              fullWidth
              data={[
                { label: "Monthly", value: "monthly" },
                { label: "Yearly (25% OFF)", value: "yearly" },
              ]}
            />

            <Title order={3} ta="center" mt="sm" mb="xs">
              {plan.name}
            </Title>
            <Text ta="center" size="lg" fw={700}>
              {interval === "monthly" && (
                <>
                  ${price}{" "}
                  <Text span size="sm" fw={500} c="dimmed">
                    /user/month
                  </Text>
                </>
              )}
              {interval === "yearly" && (
                <>
                  ${yearlyMonthPrice}{" "}
                  <Text span size="sm" fw={500} c="dimmed">
                    /user/month
                  </Text>
                </>
              )}
              <br/>
              <Text span ta="center" size="md" fw={500} c="dimmed">
                billed {interval}
              </Text>
            </Text>

            <Card.Section mt="lg">
              <Button onClick={() => handleCheckout(priceId)} fullWidth>
                Subscribe
              </Button>
            </Card.Section>

            <Card.Section mt="md">
              <List
                spacing="xs"
                size="sm"
                center
                icon={
                  <ThemeIcon variant="light" size={24} radius="xl">
                    <IconCheck size={16} />
                  </ThemeIcon>
                }
              >
                {plan.features.map((feature, index) => (
                  <List.Item key={index}>{feature}</List.Item>
                ))}
              </List>
            </Card.Section>
          </Card>
        );
      })}
    </Group>
  );
}
