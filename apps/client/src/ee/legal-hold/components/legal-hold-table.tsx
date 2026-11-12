import {
  ActionIcon,
  Anchor,
  Avatar,
  Badge,
  Group,
  Menu,
  Skeleton,
  Table,
  Text,
  Tooltip,
} from "@mantine/core";
import {
  IconDots,
  IconEdit,
  IconFileExport,
  IconLockOpen,
} from "@tabler/icons-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import NoTableResults from "@/components/common/no-table-results";
import { CustomAvatar } from "@/components/ui/custom-avatar";
import rowClasses from "@/components/ui/clickable-table-row.module.css";
import { formatLocalized, useDateFnsLocale } from "@/lib/date-locale";
import { LEGAL_HOLD_STATUS_BADGES } from "@/ee/legal-hold/legal-hold.utils";
import type { LegalHoldListItem } from "@/ee/legal-hold/types/legal-hold.types";

const MAX_VISIBLE_CUSTODIANS = 5;

type LegalHoldTableProps = {
  legalHolds: LegalHoldListItem[];
  isLoading: boolean;
  emptyMessage: string;
  // Left out once the license lapses, which leaves export and release
  onEdit?: (legalHold: LegalHoldListItem) => void;
  onExport: (legalHold: LegalHoldListItem) => void;
  onRelease: (legalHold: LegalHoldListItem) => void;
};

function TableSkeleton() {
  return (
    <>
      {[200, 150, 240].map((width) => (
        <Table.Tr key={width}>
          <Table.Td>
            <Skeleton height={14} width={width} mb={6} />
            <Skeleton height={10} width={width - 60} />
          </Table.Td>
          <Table.Td>
            <Group gap={4} wrap="nowrap">
              <Skeleton height={26} width={26} circle />
              <Skeleton height={26} width={26} circle />
              <Skeleton height={26} width={26} circle />
            </Group>
          </Table.Td>
          <Table.Td>
            <Skeleton height={14} width={24} />
          </Table.Td>
          <Table.Td>
            <Skeleton height={14} width={90} />
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

export function LegalHoldTable({
  legalHolds,
  isLoading,
  emptyMessage,
  onEdit,
  onExport,
  onRelease,
}: LegalHoldTableProps) {
  const { t } = useTranslation();
  const locale = useDateFnsLocale();

  return (
    <Table.ScrollContainer minWidth={760}>
      <Table highlightOnHover verticalSpacing="sm" aria-busy={isLoading}>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t("Name")}</Table.Th>
            <Table.Th>{t("Custodians")}</Table.Th>
            <Table.Th>{t("Spaces")}</Table.Th>
            <Table.Th>{t("Created")}</Table.Th>
            <Table.Th>{t("Status")}</Table.Th>
            <Table.Th aria-label={t("Actions")} />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {isLoading ? (
            <TableSkeleton />
          ) : legalHolds.length > 0 ? (
            legalHolds.map((legalHold) => {
              const isActive = legalHold.status === "active";
              const status = LEGAL_HOLD_STATUS_BADGES[legalHold.status];
              const custodians = legalHold.custodians.slice(
                0,
                MAX_VISIBLE_CUSTODIANS,
              );
              const hiddenCustodians =
                legalHold.custodianCount - custodians.length;

              return (
                <Table.Tr key={legalHold.id} className={rowClasses.row}>
                  <Table.Td>
                    <Anchor
                      component={Link}
                      to={`/settings/legal-holds/${legalHold.id}`}
                      underline="never"
                      className={rowClasses.link}
                      style={{ color: "var(--mantine-color-text)" }}
                    >
                      <Text fz="sm" fw={500} lineClamp={1}>
                        {legalHold.name}
                      </Text>
                    </Anchor>
                    {legalHold.description && (
                      <Text fz="xs" c="dimmed" lineClamp={1}>
                        {legalHold.description}
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    {legalHold.custodianCount > 0 ? (
                      <Tooltip.Group openDelay={300} closeDelay={100}>
                        <Avatar.Group spacing={8}>
                          {custodians.map((custodian) => (
                            <Tooltip
                              key={custodian.id}
                              label={custodian.name ?? custodian.email}
                              withArrow
                            >
                              <CustomAvatar
                                size="sm"
                                avatarUrl={custodian.avatarUrl}
                                name={custodian.name ?? custodian.email}
                              />
                            </Tooltip>
                          ))}
                          {hiddenCustodians > 0 && (
                            <Avatar size="sm" color="gray">
                              +{hiddenCustodians}
                            </Avatar>
                          )}
                        </Avatar.Group>
                      </Tooltip.Group>
                    ) : (
                      <Text fz="sm" c="dimmed">
                        {t("None")}
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Text fz="sm">{legalHold.spaceCount}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text fz="sm" style={{ whiteSpace: "nowrap" }}>
                      {formatLocalized(
                        legalHold.createdAt,
                        "MMM d, yyyy",
                        "PP",
                        locale,
                      )}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light" color={status?.color ?? "gray"}>
                      {status ? t(status.label) : legalHold.status}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Menu shadow="md" width={180} position="bottom-end">
                      <Menu.Target>
                        <ActionIcon
                          variant="subtle"
                          color="gray"
                          aria-label={t("Actions for {{name}}", {
                            name: legalHold.name,
                          })}
                        >
                          <IconDots size={18} />
                        </ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown>
                        {onEdit && isActive && (
                          <Menu.Item
                            leftSection={<IconEdit size={16} />}
                            onClick={() => onEdit(legalHold)}
                          >
                            {t("Edit")}
                          </Menu.Item>
                        )}
                        <Menu.Item
                          leftSection={<IconFileExport size={16} />}
                          onClick={() => onExport(legalHold)}
                        >
                          {t("Export")}
                        </Menu.Item>
                        {isActive && (
                          <>
                            <Menu.Divider />
                            <Menu.Item
                              color="red"
                              leftSection={<IconLockOpen size={16} />}
                              onClick={() => onRelease(legalHold)}
                            >
                              {t("Release")}
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
