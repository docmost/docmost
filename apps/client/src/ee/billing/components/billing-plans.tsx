import {
  Button,
  Card,
  List,
  ThemeIcon,
  Title,
  Text,
  Group,
  Select,
  Container,
  Stack,
  Badge,
  Flex,
  Switch,
} from "@mantine/core";
import { useState } from "react";
import { IconCheck } from "@tabler/icons-react";
import { getCheckoutLink } from "@/ee/billing/services/billing-service.ts";
import { useBillingPlans } from "@/ee/billing/queries/billing-query.ts";

export default function BillingPlans() {
  const { data: plans } = useBillingPlans();
  const [isAnnual, setIsAnnual] = useState(true);
  const [selectedTierValue, setSelectedTierValue] = useState<string | null>(
    null,
  );

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

  if (!plans || plans.length === 0) {
    return null;
  }

  const firstPlan = plans[0];

  // Set initial tier value if not set
  if (!selectedTierValue && firstPlan.pricingTiers.length > 0) {
    setSelectedTierValue(firstPlan.pricingTiers[0].upTo.toString());
    return null;
  }

  if (!selectedTierValue) {
    return null;
  }

  const selectData = firstPlan.pricingTiers
    .filter((tier) => !tier.custom)
    .map((tier, index) => {
      const prevMaxUsers =
        index > 0 ? firstPlan.pricingTiers[index - 1].upTo : 0;
      return {
        value: tier.upTo.toString(),
        label: `${prevMaxUsers + 1}-${tier.upTo} users`,
      };
    });

  return (
    <Container size="xl" py="xl">
      {/* Controls Section */}
      <Stack gap="xl" mb="md">
        {/* Team Size and Billing Controls */}
        <Group justify="center" align="center" gap="sm">
          <Select
            label="Team size"
            description="Select the number of users"
            value={selectedTierValue}
            onChange={setSelectedTierValue}
            data={selectData}
            w={250}
            size="md"
            allowDeselect={false}
          />

          <Group justify="center" align="start">
            <Flex justify="center" gap="md" align="center">
              <Text size="md">Monthly</Text>
              <Switch
                defaultChecked={isAnnual}
                onChange={(event) => setIsAnnual(event.target.checked)}
                size="sm"
              />
              <Text size="md">
                Annually
                <Badge component="span" variant="light" color="blue">
                  15% OFF
                </Badge>
              </Text>
            </Flex>
          </Group>
        </Group>
      </Stack>

      {/* Plans Grid */}
      <Group justify="center" gap="lg" align="stretch">
        {plans.map((plan, index) => {
          const tieredPlan = plan;
          const planSelectedTier =
            tieredPlan.pricingTiers.find(
              (tier) => tier.upTo.toString() === selectedTierValue,
            ) || tieredPlan.pricingTiers[0];

          const price = isAnnual
            ? planSelectedTier.yearly
            : planSelectedTier.monthly;
          const priceId = isAnnual ? plan.yearlyId : plan.monthlyId;

          return (
            <Card
              key={plan.name}
              withBorder
              radius="lg"
              shadow="sm"
              p="xl"
              w={350}
              miw={300}
              style={{
                position: "relative",
              }}
            >
              <Stack gap="lg">
                {/* Plan Header */}
                <Stack gap="xs">
                  <Title order={3} size="h4">
                    {plan.name}
                  </Title>
                  {plan.description && (
                    <Text size="sm" c="dimmed">
                      {plan.description}
                    </Text>
                  )}
                </Stack>

                {/* Pricing */}
                <Stack gap="xs">
                  <Group align="baseline" gap="xs">
                    <Title order={1} size="h1">
                      ${isAnnual ? (price / 12).toFixed(0) : price}
                    </Title>
                    <Text size="lg" c="dimmed">
                      per {isAnnual ? "month" : "month"}
                    </Text>
                  </Group>
                  {isAnnual && (
                    <Text size="sm" c="dimmed">
                      Billed annually
                    </Text>
                  )}
                  <Text size="md" fw={500}>
                    for up to {planSelectedTier.upTo} users
                  </Text>
                </Stack>

                {/* CTA Button */}
                <Button onClick={() => handleCheckout(priceId)} fullWidth>
                  Upgrade
                </Button>

                {/* Features */}
                <List
                  spacing="xs"
                  size="sm"
                  icon={
                    <ThemeIcon size={20} radius="xl">
                      <IconCheck size={14} />
                    </ThemeIcon>
                  }
                >
                  {plan.features.map((feature, featureIndex) => (
                    <List.Item key={featureIndex}>{feature}</List.Item>
                  ))}
                </List>
              </Stack>
            </Card>
          );
        })}
      </Group>
    </Container>
  );
}
