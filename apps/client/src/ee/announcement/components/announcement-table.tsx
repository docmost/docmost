import {
  ActionIcon,
  Badge,
  ColorSwatch,
  Group,
  Menu,
  Skeleton,
  Stack,
  Table,
  Text,
} from "@mantine/core";
import {
  IconArchive,
  IconArchiveOff,
  IconDots,
  IconEdit,
  IconTrash,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import NoTableResults from "@/components/common/no-table-results";
import {
  ANNOUNCEMENT_COLOR_STYLES,
  ANNOUNCEMENT_TYPE_LABELS,
} from "@/ee/announcement/announcement.constants";
import {
  formatAnnouncementTime,
  getAnnouncementPreview,
} from "@/ee/announcement/announcement.utils";
import type {
  AnnouncementStatus,
  IAnnouncement,
} from "@/ee/announcement/types/announcement.types";

const STATUS_BADGES: Record<
  AnnouncementStatus,
  { label: string; color: string }
> = {
  active: { label: "Active", color: "green" },
  scheduled: { label: "Scheduled", color: "blue" },
  archived: { label: "Archived", color: "gray" },
};

type AnnouncementTableProps = {
  announcements: IAnnouncement[];
  isLoading: boolean;
  emptyMessage: string;
  // Left out once the license lapses, which leaves archive and delete
  onEdit?: (announcement: IAnnouncement) => void;
  onArchive: (announcement: IAnnouncement) => void;
  onUnarchive?: (announcement: IAnnouncement) => void;
  onDelete: (announcement: IAnnouncement) => void;
};

function TableSkeleton() {
  return (
    <>
      {[220, 160, 260].map((width) => (
        <Table.Tr key={width}>
          <Table.Td>
            <Group gap="xs" wrap="nowrap">
              <Skeleton height={12} width={12} circle />
              <Skeleton height={14} width={width} />
            </Group>
          </Table.Td>
          <Table.Td>
            <Skeleton height={14} width={60} />
          </Table.Td>
          <Table.Td>
            <Skeleton height={14} width={100} />
          </Table.Td>
          <Table.Td>
            <Stack gap={6}>
              <Skeleton height={14} width={140} />
              <Skeleton height={14} width={110} />
            </Stack>
          </Table.Td>
          <Table.Td>
            <Skeleton height={20} width={70} radius="xl" />
          </Table.Td>
          <Table.Td>
            <Skeleton height={28} width={28} circle />
          </Table.Td>
        </Table.Tr>
      ))}
    </>
  );
}

export function AnnouncementTable({
  announcements,
  isLoading,
  emptyMessage,
  onEdit,
  onArchive,
  onUnarchive,
  onDelete,
}: AnnouncementTableProps) {
  const { t, i18n } = useTranslation();

  return (
    <Table.ScrollContainer minWidth={760}>
      <Table highlightOnHover verticalSpacing="sm" aria-busy={isLoading}>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t("Title")}</Table.Th>
            <Table.Th>{t("Type")}</Table.Th>
            <Table.Th>{t("Audience")}</Table.Th>
            <Table.Th>{t("Schedule")}</Table.Th>
            <Table.Th>{t("Status")}</Table.Th>
            <Table.Th aria-label={t("Actions")} />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {isLoading ? (
            <TableSkeleton />
          ) : announcements.length > 0 ? (
            announcements.map((announcement) => {
              const preview = getAnnouncementPreview(announcement.content);
              // A bundle loaded before a deploy can meet a type, color or status it does not know
              const color =
                ANNOUNCEMENT_COLOR_STYLES[announcement.color] ??
                ANNOUNCEMENT_COLOR_STYLES.gray;
              const typeLabel = ANNOUNCEMENT_TYPE_LABELS[announcement.type];
              const status = STATUS_BADGES[announcement.status];
              const canArchive =
                announcement.status === "active" ||
                announcement.status === "scheduled";
              const canDelete = announcement.status === "archived";
              // An expired announcement needs a later end time before it can come back
              const canUnarchive =
                !!onUnarchive &&
                canDelete &&
                (!announcement.endsAt ||
                  Date.parse(announcement.endsAt) > Date.now());

              return (
                <Table.Tr key={announcement.id}>
                  <Table.Td>
                    <Group gap="xs" wrap="nowrap">
                      <ColorSwatch
                        color={color.background}
                        size={12}
                        role="img"
                        aria-label={t(color.label)}
                        style={{ flexShrink: 0 }}
                      />
                      <div style={{ minWidth: 0 }}>
                        <Text fz="sm" fw={500} lineClamp={1}>
                          {announcement.title}
                        </Text>
                        <Text fz="xs" c="dimmed" lineClamp={1}>
                          {preview}
                        </Text>
                      </div>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Text fz="sm">
                      {typeLabel ? t(typeLabel) : announcement.type}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text fz="sm" style={{ whiteSpace: "nowrap" }}>
                      {announcement.audience === "everyone"
                        ? t("Everyone")
                        : t("Logged-in users")}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text fz="sm" style={{ whiteSpace: "nowrap" }}>
                      {formatAnnouncementTime(
                        announcement.startsAt,
                        i18n.language,
                      )}
                    </Text>
                    <Text fz="sm" style={{ whiteSpace: "nowrap" }}>
                      {announcement.endsAt
                        ? formatAnnouncementTime(
                            announcement.endsAt,
                            i18n.language,
                          )
                        : t("No end")}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light" color={status?.color ?? "gray"}>
                      {status ? t(status.label) : announcement.status}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Menu shadow="md" width={180} position="bottom-end">
                      <Menu.Target>
                        <ActionIcon
                          variant="subtle"
                          color="gray"
                          aria-label={t("Actions for {{name}}", {
                            name: announcement.title,
                          })}
                        >
                          <IconDots size={18} />
                        </ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown>
                        {onEdit && (
                          <Menu.Item
                            leftSection={<IconEdit size={16} />}
                            onClick={() => onEdit(announcement)}
                          >
                            {t("Edit")}
                          </Menu.Item>
                        )}
                        {canArchive && (
                          <Menu.Item
                            leftSection={<IconArchive size={16} />}
                            onClick={() => onArchive(announcement)}
                          >
                            {t("Archive")}
                          </Menu.Item>
                        )}
                        {canUnarchive && (
                          <Menu.Item
                            leftSection={<IconArchiveOff size={16} />}
                            onClick={() => onUnarchive(announcement)}
                          >
                            {t("Unarchive")}
                          </Menu.Item>
                        )}
                        {canDelete && (
                          <>
                            {(onEdit || canUnarchive) && <Menu.Divider />}
                            <Menu.Item
                              color="red"
                              leftSection={<IconTrash size={16} />}
                              onClick={() => onDelete(announcement)}
                            >
                              {t("Delete")}
                            </Menu.Item>
                          </>
                        )}
                      </Menu.Dropdown>
                    </Menu>
                  </Table.Td>
                </Table.Tr>
              );
            })
          ) : (
            <NoTableResults colSpan={6} text={emptyMessage} />
          )}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}
