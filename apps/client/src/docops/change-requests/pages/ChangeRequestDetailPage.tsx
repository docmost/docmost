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
import { IconAlertCircle, IconExternalLink } from "@tabler/icons-react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useCrQuery } from "../hooks/useChangeRequests";
import { CRStateBadge } from "../components/CRStateBadge";
import { CRTransitionButtons } from "../components/CRTransitionButtons";
import { CRTimeline } from "../components/CRTimeline";
import { CRExternalRefsList } from "../components/CRExternalRefsList";
import { CRCommentsThread } from "../components/CRCommentsThread";
import type { CrPriority, CrStatus } from "../types/cr.types";
import { getAppName, getSpaceUrl } from "@/lib/config";
import useCurrentUser from "@/features/user/hooks/use-current-user";

const PRIORITY_COLORS: Record<CrPriority, string> = {
  LOW: "gray",
  MEDIUM: "blue",
  HIGH: "orange",
  CRITICAL: "red",
};

const EDITABLE_REF_STATUSES: CrStatus[] = ["IN_PROGRESS"];

export default function ChangeRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { data: currentUserData } = useCurrentUser();
  const currentUserId = currentUserData?.user?.id;

  const { data: cr, isLoading, isError } = useCrQuery(id);

  if (isLoading) {
    return (
      <Container size="900" pt="xl">
        <Skeleton height={40} mb="md" width="60%" />
        <Skeleton height={24} mb="sm" width="30%" />
        <Skeleton height={100} mt="lg" />
        <Skeleton height={200} mt="lg" />
      </Container>
    );
  }

  if (isError || !cr) {
    return (
      <Container size="900" pt="xl">
        <Alert icon={<IconAlertCircle size={16} />} color="red">
          {t("Change request not found or failed to load.")}
        </Alert>
      </Container>
    );
  }

  const canEditRefs =
    EDITABLE_REF_STATUSES.includes(cr.status) && cr.implementerId === currentUserId;

  const servicePath = cr.serviceId ? `/services/${cr.serviceId}` : "/services";

  return (
    <>
      <Helmet>
        <title>
          {cr.title} — {getAppName()}
        </title>
      </Helmet>

      <Container size="900" pt="xl">
        <Stack gap="lg">
          {/* Header */}
          <Group justify="space-between" align="flex-start" wrap="wrap">
            <Stack gap={4}>
              <Title order={2}>{cr.title}</Title>
              <Group gap="xs">
                <CRStateBadge status={cr.status} size="md" />
                <Badge
                  color={PRIORITY_COLORS[cr.priority]}
                  variant="light"
                  size="md"
                >
                  {t(cr.priority)}
                </Badge>
                {cr.impact && (
                  <Badge color="gray" variant="outline" size="md">
                    {t("Impact")}: {t(cr.impact)}
                  </Badge>
                )}
                <Badge color="blue" variant="outline" size="md">
                  {t("Doc v{{version}}", { version: cr.serviceDocVersion ?? '0.0.0' })}
                </Badge>
                {cr.status === 'PUBLISHED' && cr.docVersion && (
                  <Badge color="green" size="md">
                    {t("Pubblicata come v{{version}}", { version: cr.docVersion })}
                  </Badge>
                )}
              </Group>
            </Stack>

            <CRTransitionButtons cr={cr} />
          </Group>

          {/* Metadata */}
          <Paper withBorder p="md" radius="md">
            <Stack gap="sm">
              {cr.description && (
                <Stack gap={2}>
                  <Text size="sm" fw={600}>{t("Description")}</Text>
                  <Text size="sm">{cr.description}</Text>
                </Stack>
              )}
              {cr.justification && (
                <Stack gap={2}>
                  <Text size="sm" fw={600}>{t("Justification")}</Text>
                  <Text size="sm">{cr.justification}</Text>
                </Stack>
              )}
              <Group gap="xl" wrap="wrap">
                {cr.dueDate && (
                  <Stack gap={2}>
                    <Text size="xs" c="dimmed">{t("Due date")}</Text>
                    <Text size="sm">{new Date(cr.dueDate).toLocaleDateString()}</Text>
                  </Stack>
                )}
                {cr.approvedAt && (
                  <Stack gap={2}>
                    <Text size="xs" c="dimmed">{t("Approved at")}</Text>
                    <Text size="sm">{new Date(cr.approvedAt).toLocaleDateString()}</Text>
                  </Stack>
                )}
                {cr.publishedAt && (
                  <Stack gap={2}>
                    <Text size="xs" c="dimmed">{t("Published at")}</Text>
                    <Text size="sm">{new Date(cr.publishedAt).toLocaleDateString()}</Text>
                  </Stack>
                )}
                {cr.createdAt && (
                  <Stack gap={2}>
                    <Text size="xs" c="dimmed">{t("Created")}</Text>
                    <Text size="sm">{new Date(cr.createdAt).toLocaleDateString()}</Text>
                  </Stack>
                )}
              </Group>
              <Group gap="xs" mt="xs">
                <Button
                  component={Link}
                  to={servicePath}
                  variant="subtle"
                  size="xs"
                  rightSection={<IconExternalLink size={12} />}
                >
                  {t("View service")}
                </Button>
                {cr.pageId && cr.serviceCode && (
                  <Button
                    component="a"
                    href={getSpaceUrl(cr.serviceCode)}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="subtle"
                    size="xs"
                    rightSection={<IconExternalLink size={12} />}
                  >
                    {t("View document")}
                  </Button>
                )}
              </Group>
            </Stack>
          </Paper>

          {/* External refs */}
          {cr.status === "IN_PROGRESS" && (
            <Paper withBorder p="md" radius="md">
              <Title order={5} mb="sm">
                {t("External references")}
              </Title>
              <CRExternalRefsList cr={cr} canEdit={canEditRefs} />
            </Paper>
          )}

          {/* Timeline + notes */}
          <Group align="flex-start" gap="xl" wrap="wrap">
            <Paper withBorder p="md" radius="md" flex={1} style={{ minWidth: 280 }}>
              <Title order={5} mb="sm">
                {t("Timeline")}
              </Title>
              <CRTimeline events={cr.events ?? []} />
            </Paper>

            <Paper withBorder p="md" radius="md" flex={1} style={{ minWidth: 280 }}>
              <Title order={5} mb="sm">
                {t("Transition notes")}
              </Title>
              <CRCommentsThread events={cr.events ?? []} />
            </Paper>
          </Group>
        </Stack>
      </Container>
    </>
  );
}
