import { Table, Text, Group, Skeleton, Anchor, Badge } from "@mantine/core";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  IVerificationListItem,
  VerificationStatus,
} from "@/ee/page-verification/types/page-verification.types";
import { CustomAvatar } from "@/components/ui/custom-avatar";
import { buildPageUrl } from "@/features/page/page.utils";
import { format } from "date-fns";
import NoTableResults from "@/components/common/no-table-results";

type VerificationListTableProps = {
  items?: IVerificationListItem[];
  isLoading: boolean;
};

function statusBadge(status: VerificationStatus | null, t: (s: string) => string) {
  switch (status) {
    case "verified":
      return <Badge color="green" variant="light" size="sm">{t("Verified")}</Badge>;
    case "expiring":
      return <Badge color="yellow" variant="light" size="sm">{t("Expiring")}</Badge>;
    case "expired":
      return <Badge color="red" variant="light" size="sm">{t("Expired")}</Badge>;
    case "approved":
      return <Badge color="green" variant="light" size="sm">{t("Approved")}</Badge>;
    case "draft":
      return <Badge color="gray" variant="light" size="sm">{t("Draft")}</Badge>;
    case "in_approval":
      return <Badge color="blue" variant="light" size="sm">{t("In approval")}</Badge>;
    case "obsolete":
      return <Badge color="red" variant="light" size="sm">{t("Obsolete")}</Badge>;
    default:
      return null;
  }
}

function verifiedUntilText(item: IVerificationListItem, t: (s: string) => string): string {
  if (item.type === "qms") {
    if (item.status === "approved") return t("Indefinitely");
    return "—";
  }

  if (!item.expiresAt) return t("Indefinitely");

  const expires = new Date(item.expiresAt);
  const now = new Date();

  if (expires <= now) return t("Expired");
  return format(expires, "MMM d, yyyy");
}

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <Table.Tr key={i}>
          <Table.Td>
            <div>
              <Skeleton height={14} width={160} mb={4} />
              <Skeleton height={10} width={100} />
            </div>
          </Table.Td>
          <Table.Td>
            <Group gap="sm" wrap="nowrap">
              <Skeleton circle height={28} />
              <Skeleton height={14} width={80} />
            </Group>
          </Table.Td>
          <Table.Td>
            <Skeleton height={14} width={100} />
          </Table.Td>
          <Table.Td>
            <Skeleton height={20} width={60} />
          </Table.Td>
        </Table.Tr>
      ))}
    </>
  );
}

export default function VerificationListTable({
  items,
  isLoading,
}: VerificationListTableProps) {
  const { t } = useTranslation();

  return (
    <Table.ScrollContainer minWidth={600}>
      <Table highlightOnHover verticalSpacing="xs">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t("Page")}</Table.Th>
            <Table.Th>{t("Owner")}</Table.Th>
            <Table.Th>{t("Verified until")}</Table.Th>
            <Table.Th>{t("Status")}</Table.Th>
          </Table.Tr>
        </Table.Thead>

        <Table.Tbody>
          {isLoading ? (
            <TableSkeleton />
          ) : items && items.length > 0 ? (
            items.map((item) => {
              const primaryVerifier = item.verifiers[0];

              const pageUrl = buildPageUrl(
                item.spaceSlug,
                item.pageSlugId,
                item.pageTitle ?? undefined,
              );

              return (
                <Table.Tr key={item.id}>
                  <Table.Td>
                    <Anchor
                      size="sm"
                      underline="never"
                      style={{ color: "var(--mantine-color-text)" }}
                      component={Link}
                      to={pageUrl}
                    >
                      <Text fz="sm" fw={500} lineClamp={1}>
                        {item.pageIcon ? `${item.pageIcon} ` : ""}
                        {item.pageTitle || t("Untitled")}
                      </Text>
                    </Anchor>
                    <Text fz="xs" c="dimmed" lineClamp={1}>
                      {item.spaceName}
                    </Text>
                  </Table.Td>

                  <Table.Td>
                    {primaryVerifier ? (
                      <Group gap="sm" wrap="nowrap">
                        <CustomAvatar
                          avatarUrl={primaryVerifier.avatarUrl}
                          name={primaryVerifier.name}
                          size={28}
                        />
                        <Text fz="sm" lineClamp={1}>
                          {primaryVerifier.name}
                        </Text>
                      </Group>
                    ) : (
                      <Text fz="sm" c="dimmed">—</Text>
                    )}
                  </Table.Td>

                  <Table.Td>
                    <Text fz="sm" style={{ whiteSpace: "nowrap" }}>
                      {verifiedUntilText(item, t)}
                    </Text>
                  </Table.Td>

                  <Table.Td>
                    {statusBadge(item.status as VerificationStatus, t)}
                  </Table.Td>
                </Table.Tr>
              );
            })
          ) : (
            <NoTableResults colSpan={4} />
          )}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}
