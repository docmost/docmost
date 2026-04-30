import { useState } from "react";
import {
  Button,
  Divider,
  Group,
  Skeleton,
  Stack,
  Table,
  Text,
} from "@mantine/core";
import { IconDevices } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import {
  useGetSessionsQuery,
  useRevokeSessionMutation,
  useRevokeAllSessionsMutation,
} from "@/features/session/queries/session-query";
import { formattedDate } from "@/lib/time";

const PAGE_SIZE = 5;

export default function SessionList() {
  const { t } = useTranslation();
  const { data: sessions, isLoading } = useGetSessionsQuery();
  const revokeSessionMutation = useRevokeSessionMutation();
  const revokeAllSessionsMutation = useRevokeAllSessionsMutation();
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const otherSessions = sessions?.filter((s) => !s?.isCurrentDevice) ?? [];
  const visibleSessions = sessions?.slice(0, visibleCount) ?? [];
  const hasMore = sessions && visibleCount < sessions.length;

  if (isLoading) {
    return (
      <Table verticalSpacing="md">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t("Device Name")}</Table.Th>
            <Table.Th>{t("Last Active")}</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {[1, 2, 3].map((i) => (
            <Table.Tr key={i}>
              <Table.Td>
                <Group gap="xs">
                  <Skeleton height={18} width={18} radius="sm" />
                  <Skeleton height={14} width={140} radius="xs" />
                </Group>
              </Table.Td>
              <Table.Td>
                <Skeleton height={14} width={120} radius="xs" />
              </Table.Td>
              <Table.Td>
                <Skeleton height={30} width={70} radius="sm" />
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    );
  }

  return (
    <Stack>
      {otherSessions.length > 0 && (
        <>
          <div>
            <Text fw={500}>{t("Log out of all devices")}</Text>
            <Group justify="space-between" align="center" mt={4}>
              <Text size="sm" c="dimmed">
                {t(
                  "Log out of all sessions except this device",
                )}
              </Text>
              <Button
                variant="outline"
                color="red"
                size="xs"
                loading={revokeAllSessionsMutation.isPending}
                onClick={() => revokeAllSessionsMutation.mutate()}
              >
                {t("Log out of all devices")}
              </Button>
            </Group>
          </div>
          <Divider />
        </>
      )}

      <Table verticalSpacing="md">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t("Device Name")}</Table.Th>
            <Table.Th>{t("Last Active")}</Table.Th>
            {otherSessions.length > 0 && <Table.Th />}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {visibleSessions.map((session) => (
            <Table.Tr key={session.id}>
              <Table.Td>
                <Group gap="xs">
                  <IconDevices size={18} stroke={1.5} />
                  <div>
                    <Text size="sm">
                      {session.deviceName || t("Unknown device")}
                    </Text>
                    {session?.isCurrentDevice && (
                      <Text size="xs" c="blue">
                        {t("This Device")}
                      </Text>
                    )}
                  </div>
                </Group>
              </Table.Td>
              <Table.Td>
                <Text size="sm">
                  {session?.isCurrentDevice
                    ? t("Now")
                    : formattedDate(new Date(session.lastActiveAt))}
                </Text>
              </Table.Td>
              {otherSessions.length > 0 && (
                <Table.Td>
                  {!session?.isCurrentDevice && (
                    <Button
                      variant="outline"
                      size="xs"
                      loading={revokeSessionMutation.isPending}
                      onClick={() =>
                        revokeSessionMutation.mutate({
                          sessionId: session.id,
                        })
                      }
                    >
                      {t("Log out")}
                    </Button>
                  )}
                </Table.Td>
              )}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      {hasMore && (
        <Button
          variant="subtle"
          size="xs"
          onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
        >
          {t("Load more")}
        </Button>
      )}

      {(!sessions || sessions.length === 0) && (
        <Text size="sm" c="dimmed" ta="center">
          {t("No active sessions")}
        </Text>
      )}
    </Stack>
  );
}
