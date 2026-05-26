import { Alert, Badge, Group, Text, Anchor } from "@mantine/core";
import { IconLock } from "@tabler/icons-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { ChangeRequest } from "../types/service.types";

interface EditLockBannerProps {
  cr: ChangeRequest;
}

const PRIORITY_COLORS: Record<string, string> = {
  LOW: "gray",
  MEDIUM: "blue",
  HIGH: "orange",
  CRITICAL: "red",
};

export function EditLockBanner({ cr }: EditLockBannerProps) {
  const { t } = useTranslation();
  const shortId = cr.id.slice(0, 8).toUpperCase();

  return (
    <Alert
      icon={<IconLock size={16} />}
      title={
        <Group gap="xs" wrap="nowrap">
          <Text size="sm" fw={600}>
            {t("Editing in context of CR-{{id}}", { id: shortId })}
          </Text>
          <Badge size="xs" color={PRIORITY_COLORS[cr.priority] ?? "gray"}>
            {cr.priority}
          </Badge>
          <Badge size="xs" color="teal" variant="light">
            {t(cr.status)}
          </Badge>
        </Group>
      }
      color="teal"
      mb="md"
      aria-label={t("Active change request banner")}
    >
      <Group gap="xs">
        <Text size="sm" lineClamp={1}>
          {cr.title}
        </Text>
        <Anchor
          component={Link}
          to={`/change-requests/${cr.id}`}
          size="sm"
          fw={500}
        >
          {t("View CR")} →
        </Anchor>
      </Group>
    </Alert>
  );
}
