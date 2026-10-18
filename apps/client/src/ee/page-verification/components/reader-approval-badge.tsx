import { Popover, Stack, Text, UnstyledButton } from "@mantine/core";
import { IconRosetteDiscountCheckFilled } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { formatLocalized, useDateFnsLocale } from "@/lib/date-locale";
import { useTimeAgo } from "@/hooks/use-time-ago";
import type { IPageVerificationInfo } from "@/ee/page-verification/types/page-verification.types";
import { getReaderBadgeLabel } from "@/ee/page-verification/utils/approval-state";
import { getStatusColor } from "./verification-status";

type ReaderApprovalBadgeProps = {
  info: IPageVerificationInfo;
};

// Readers get a read-only summary; the workflow is for editors and approvers.
export function ReaderApprovalBadge({ info }: ReaderApprovalBadgeProps) {
  const { t } = useTranslation();
  const label = getReaderBadgeLabel(info, t);
  const version = info.readerVersion;
  const approvedAgo = useTimeAgo(version?.approvedAt ?? undefined);
  const locale = useDateFnsLocale();

  if (!label) return null;

  const color = getStatusColor(info.status);

  return (
    <Popover position="bottom-start" shadow="md" width={280} withArrow>
      <Popover.Target>
        <UnstyledButton
          aria-label={label}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            cursor: "pointer",
          }}
        >
          <IconRosetteDiscountCheckFilled
            size={18}
            color={`var(--mantine-color-${color.replace(".", "-")})`}
            aria-hidden="true"
          />
          <Text size="sm" c={color}>
            {label}
          </Text>
        </UnstyledButton>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap="xs">
          {info.status === "approved" && (
            <>
              <div>
                <Text size="sm">
                  {t("Approved by {{name}} {{time}}", {
                    name: version?.approvedBy?.name ?? t("Someone"),
                    time: approvedAgo,
                  })}
                </Text>
                {version?.approvedAt && (
                  <Text size="xs" c="dimmed">
                    {formatLocalized(
                      new Date(version.approvedAt),
                      "MMM d, yyyy",
                      "PP",
                      locale,
                    )}
                  </Text>
                )}
              </div>
              {version?.changeSummary && (
                <div>
                  <Text size="xs" fw={600} tt="uppercase" c="dimmed" mb={2}>
                    {t("Change summary")}
                  </Text>
                  <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
                    {version.changeSummary}
                  </Text>
                </div>
              )}
            </>
          )}
          {info.status === "not_approved" && (
            <Text size="sm">
              {t("This content was published before approval was turned on.")}
            </Text>
          )}
          {info.status === "obsolete" && (
            <Text size="sm">
              {t("This page is obsolete. It is kept for reference and may be out of date.")}
            </Text>
          )}
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}
