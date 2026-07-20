import { Group, Stack, Text, ThemeIcon } from "@mantine/core";
import {
  IconCheck,
  IconClock,
  IconX,
  IconMessageQuestion,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { CustomAvatar } from "@/components/ui/custom-avatar";
import { IReviewDecisionEntry } from "@/ee/page-verification/types/page-verification.types";

const ICONS = {
  approved: { icon: IconCheck, color: "teal" },
  rejected: { icon: IconX, color: "red" },
  needs_clarification: { icon: IconMessageQuestion, color: "orange" },
  pending: { icon: IconClock, color: "gray" },
} as const;

type ReviewerProgressProps = {
  reviews: IReviewDecisionEntry[];
};

export function ReviewerProgress({ reviews }: ReviewerProgressProps) {
  const { t } = useTranslation();
  const pendingCount = reviews.filter((r) => r.decision === "pending").length;

  return (
    <Stack gap="xs">
      <Text size="sm" fw={600} c="dimmed">
        {pendingCount > 0
          ? t("Waiting on {{count}} of {{total}}", {
              count: pendingCount,
              total: reviews.length,
            })
          : t("All reviewers have responded")}
      </Text>
      {reviews.map((review) => {
        const { icon: Icon, color } = ICONS[review.decision];
        return (
          <Group key={review.id} gap="xs" wrap="nowrap">
            <CustomAvatar
              size="sm"
              avatarUrl={review.verifierAvatarUrl ?? undefined}
              name={review.verifierName}
            />
            <Text size="sm" style={{ flex: 1 }}>
              {review.verifierName}
            </Text>
            <ThemeIcon size="sm" variant="light" color={color} radius="xl">
              <Icon size={12} />
            </ThemeIcon>
          </Group>
        );
      })}
    </Stack>
  );
}
