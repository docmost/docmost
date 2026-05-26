import {
  Badge,
  Container,
  Group,
  Paper,
  Skeleton,
  Stack,
  Table,
  Tabs,
  Text,
  Title,
} from "@mantine/core";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAtom } from "jotai";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";
import { useChangeRequestsQuery } from "../hooks/useChangeRequests";
import { CRStateBadge } from "../components/CRStateBadge";
import type { ChangeRequest, CrPriority } from "../types/cr.types";
import { getAppName } from "@/lib/config";

const PRIORITY_COLORS: Record<CrPriority, string> = {
  LOW: "gray",
  MEDIUM: "blue",
  HIGH: "orange",
  CRITICAL: "red",
};

function CRTable({ items, isLoading }: { items: ChangeRequest[]; isLoading: boolean }) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <Stack gap="xs">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} height={44} radius="sm" />
        ))}
      </Stack>
    );
  }

  if (!items.length) {
    return (
      <Text c="dimmed" ta="center" py="xl">
        {t("No change requests found")}
      </Text>
    );
  }

  return (
    <Paper withBorder radius="md" style={{ overflow: "hidden" }}>
      <Table highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t("Title")}</Table.Th>
            <Table.Th>{t("Status")}</Table.Th>
            <Table.Th>{t("Priority")}</Table.Th>
            <Table.Th>{t("Created")}</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {items.map((cr) => (
            <Table.Tr key={cr.id}>
              <Table.Td>
                <Text
                  component={Link}
                  to={`/change-requests/${cr.id}`}
                  size="sm"
                  fw={500}
                  c="blue"
                  style={{ textDecoration: "none" }}
                >
                  {cr.title}
                </Text>
              </Table.Td>
              <Table.Td>
                <CRStateBadge status={cr.status} />
              </Table.Td>
              <Table.Td>
                <Badge color={PRIORITY_COLORS[cr.priority]} variant="light" size="sm">
                  {t(cr.priority)}
                </Badge>
              </Table.Td>
              <Table.Td>
                <Text size="xs" c="dimmed">
                  {cr.createdAt ? new Date(cr.createdAt).toLocaleDateString() : "—"}
                </Text>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Paper>
  );
}

export default function MyChangeRequestsPage() {
  const { t } = useTranslation();
  const [currentUser] = useAtom(currentUserAtom);
  const userId = currentUser?.user?.id;

  const requested = useChangeRequestsQuery({
    requestedById: userId,
    limit: 50,
  });
  const implementing = useChangeRequestsQuery({
    implementerId: userId,
    limit: 50,
  });
  const reviewing = useChangeRequestsQuery({
    approverId: userId,
    limit: 50,
  });

  return (
    <>
      <Helmet>
        <title>{t("My CRs")} — {getAppName()}</title>
      </Helmet>

      <Container size="1000" pt="xl">
        <Title order={2} mb="lg">
          {t("My CRs")}
        </Title>

        <Tabs defaultValue="requested">
          <Tabs.List mb="md">
            <Tabs.Tab
              value="requested"
              rightSection={
                requested.data?.total ? (
                  <Badge size="xs" variant="filled" circle>
                    {requested.data.total}
                  </Badge>
                ) : undefined
              }
            >
              {t("My requests")}
            </Tabs.Tab>
            <Tabs.Tab
              value="implementing"
              rightSection={
                implementing.data?.total ? (
                  <Badge size="xs" variant="filled" circle>
                    {implementing.data.total}
                  </Badge>
                ) : undefined
              }
            >
              {t("To implement")}
            </Tabs.Tab>
            <Tabs.Tab
              value="reviewing"
              rightSection={
                reviewing.data?.total ? (
                  <Badge size="xs" variant="filled" circle>
                    {reviewing.data.total}
                  </Badge>
                ) : undefined
              }
            >
              {t("To approve")}
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="requested">
            <CRTable items={requested.data?.items ?? []} isLoading={requested.isLoading} />
          </Tabs.Panel>
          <Tabs.Panel value="implementing">
            <CRTable items={implementing.data?.items ?? []} isLoading={implementing.isLoading} />
          </Tabs.Panel>
          <Tabs.Panel value="reviewing">
            <CRTable items={reviewing.data?.items ?? []} isLoading={reviewing.isLoading} />
          </Tabs.Panel>
        </Tabs>
      </Container>
    </>
  );
}
