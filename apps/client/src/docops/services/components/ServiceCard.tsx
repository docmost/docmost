import { Badge, Card, Group, Stack, Text } from "@mantine/core";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { Service } from "../types/service.types";

interface ServiceCardProps {
  service: Service;
}

const LIFECYCLE_COLORS: Record<string, string> = {
  active: "green",
  deprecated: "orange",
  retired: "gray",
};

export function ServiceCard({ service }: ServiceCardProps) {
  const { t } = useTranslation();

  return (
    <Card
      component={Link}
      to={`/services/${service.code}`}
      withBorder
      radius="md"
      padding="md"
      style={{ textDecoration: "none", display: "block" }}
      aria-label={t("Service {{name}}", { name: service.name })}
    >
      <Stack gap="xs">
        <Group justify="space-between" wrap="nowrap">
          <Text fw={600} size="sm" lineClamp={1}>
            {service.name}
          </Text>
          <Badge
            size="xs"
            color={LIFECYCLE_COLORS[service.lifecycle_state] ?? "gray"}
            variant="light"
          >
            {t(service.lifecycle_state)}
          </Badge>
        </Group>

        <Text size="xs" c="dimmed" ff="monospace">
          {service.code}
        </Text>

        {service.description && (
          <Text size="xs" c="dimmed" lineClamp={2}>
            {service.description}
          </Text>
        )}

        {service.domain && (
          <Text size="xs" c="dimmed">
            {t("Domain")}: {service.domain}
          </Text>
        )}

        {(service.tags ?? []).length > 0 && (
          <Group gap={4} wrap="wrap">
            {(service.tags ?? []).slice(0, 4).map((tag) => (
              <Badge key={tag} size="xs" variant="outline" color="blue">
                {tag}
              </Badge>
            ))}
            {(service.tags ?? []).length > 4 && (
              <Badge size="xs" variant="outline" color="gray">
                +{service.tags.length - 4}
              </Badge>
            )}
          </Group>
        )}
      </Stack>
    </Card>
  );
}
