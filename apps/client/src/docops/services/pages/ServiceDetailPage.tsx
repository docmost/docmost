import { useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Container,
  Divider,
  Group,
  Paper,
  Skeleton,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import {
  IconAlertCircle,
  IconEdit,
  IconExternalLink,
  IconLockOff,
  IconPencil,
} from "@tabler/icons-react";
import { getAppName, getSpaceUrl } from "@/lib/config";
import useCurrentUser from "@/features/user/hooks/use-current-user";
import { useServiceQuery, useUpdateServiceMutation } from "../hooks/useServices";
import { useServiceLock } from "../hooks/useServiceLock";
import { EditLockBanner } from "../components/EditLockBanner";
import { ServiceForm } from "../components/ServiceForm";
import type { UpdateServicePayload } from "../types/service.types";

const LIFECYCLE_COLORS: Record<string, string> = {
  active: "green",
  deprecated: "orange",
  retired: "gray",
};

export default function ServiceDetailPage() {
  const { code } = useParams<{ code: string }>();
  const { t } = useTranslation();
  const { data: currentUserData } = useCurrentUser();
  const user = currentUserData?.user;
  const canEdit = user?.role === "owner" || user?.role === "admin";

  const [isEditing, setIsEditing] = useState(false);

  const { data: service, isLoading, isError } = useServiceQuery(code ?? "");
  const { isLocked, activeCr, isLoading: lockLoading } = useServiceLock(service?.id);
  const updateMutation = useUpdateServiceMutation(code ?? "");

  if (isLoading) {
    return (
      <Container size="900" pt="xl">
        <Skeleton height={40} mb="md" width="50%" />
        <Skeleton height={20} mb="sm" />
        <Skeleton height={20} mb="sm" width="70%" />
        <Skeleton height={120} mt="lg" />
      </Container>
    );
  }

  if (isError || !service) {
    return (
      <Container size="900" pt="xl">
        <Alert icon={<IconAlertCircle size={16} />} color="red">
          {t("Service not found or failed to load.")}
        </Alert>
      </Container>
    );
  }

  const handleUpdate = (payload: UpdateServicePayload) => {
    updateMutation.mutate(
      { id: service.id, payload },
      { onSuccess: () => setIsEditing(false) },
    );
  };

  return (
    <>
      <Helmet>
        <title>
          {service.name} - {getAppName()}
        </title>
      </Helmet>

      <Container size="900" pt="xl">
        <Group justify="space-between" mb="md" wrap="wrap">
          <Stack gap={4}>
            <Group gap="sm" wrap="nowrap">
              <Title order={2}>{service.name}</Title>
              <Badge
                color={LIFECYCLE_COLORS[service.lifecycleState] ?? "gray"}
                variant="light"
              >
                {t(service.lifecycleState)}
              </Badge>
            </Group>
            <Text size="sm" c="dimmed" ff="monospace">
              {service.code}
            </Text>
          </Stack>

          {canEdit && !isEditing && (
            <Button
              variant="default"
              size="sm"
              leftSection={<IconEdit size={14} />}
              onClick={() => setIsEditing(true)}
            >
              {t("Edit metadata")}
            </Button>
          )}
        </Group>

        {isEditing ? (
          <Paper withBorder p="lg" radius="md" mb="lg">
            <ServiceForm
              isEditMode
              initialValues={{
                code: service.code,
                name: service.name,
                description: service.description ?? "",
                domain: service.domain ?? "",
                lifecycleState: service.lifecycleState,
                tags: service.tags ?? [],
              }}
              isLoading={updateMutation.isPending}
              onSubmit={handleUpdate}
              onCancel={() => setIsEditing(false)}
            />
            {updateMutation.isError && (
              <Alert icon={<IconAlertCircle size={16} />} color="red" mt="sm">
                {(updateMutation.error as any)?.response?.data?.message ??
                  t("Failed to update service.")}
              </Alert>
            )}
          </Paper>
        ) : (
          <Paper withBorder p="lg" radius="md" mb="lg">
            <Stack gap="sm">
              {service.description && (
                <Text size="sm">{service.description}</Text>
              )}
              {service.domain && (
                <Group gap="xs">
                  <Text size="sm" fw={500}>
                    {t("Domain")}:
                  </Text>
                  <Text size="sm">{service.domain}</Text>
                </Group>
              )}
              {(service.tags ?? []).length > 0 && (
                <Group gap={4} wrap="wrap">
                  {service.tags.map((tag) => (
                    <Badge key={tag} size="sm" variant="outline" color="blue">
                      {tag}
                    </Badge>
                  ))}
                </Group>
              )}
            </Stack>
          </Paper>
        )}

        <Divider my="lg" />

        <Title order={4} mb="md">
          {t("Service document")}
        </Title>

        {!lockLoading && (
          <>
            {isLocked && activeCr ? (
              <>
                <EditLockBanner cr={activeCr} />
                <Button
                  component="a"
                  href={getSpaceUrl(service.code)}
                  target="_blank"
                  rel="noopener noreferrer"
                  leftSection={<IconPencil size={14} />}
                  aria-label={t("Edit document in space")}
                >
                  {t("Edit document")}
                  <IconExternalLink size={12} style={{ marginLeft: 4 }} />
                </Button>
              </>
            ) : (
              <>
                <Alert
                  icon={<IconLockOff size={16} />}
                  color="gray"
                  mb="md"
                  aria-label={t("Document is read-only")}
                >
                  <Stack gap={4}>
                    <Text size="sm" fw={500}>
                      {t("Read-only")}
                    </Text>
                    <Text size="sm">
                      {t(
                        "To edit this document, open a Change Request for this service first.",
                      )}
                    </Text>
                  </Stack>
                </Alert>
                <Group gap="sm">
                  <Button
                    component={Link}
                    to={getSpaceUrl(service.code)}
                    variant="default"
                    leftSection={<IconExternalLink size={14} />}
                    aria-label={t("View document in space")}
                  >
                    {t("View document")}
                  </Button>
                  <Button
                    component={Link}
                    to="/change-requests"
                    variant="light"
                    leftSection={<IconEdit size={14} />}
                  >
                    {t("Open a Change Request")}
                  </Button>
                </Group>
              </>
            )}
          </>
        )}
      </Container>
    </>
  );
}
