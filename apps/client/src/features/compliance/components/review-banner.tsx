import { Alert, Badge, Button, Group, Text } from "@mantine/core";
import { IconCalendarClock } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import { formattedDate } from "@/lib/time.ts";
import {
  useMarkReviewedMutation,
  useReviewInfoQuery,
} from "@/features/compliance/queries/review-query.ts";

interface ReviewBannerProps {
  pageId: string;
  canReview?: boolean;
}

export default function ReviewBanner({ pageId, canReview }: ReviewBannerProps) {
  const { t } = useTranslation();
  const { data } = useReviewInfoQuery({ pageId });
  const markReviewedMutation = useMarkReviewedMutation();

  if (!data?.setting || !data.status) {
    return null;
  }

  const handleMarkReviewed = async () => {
    try {
      await markReviewedMutation.mutateAsync({ pageId });
      notifications.show({ message: t("Marked as reviewed") });
    } catch {
      notifications.show({
        message: t("Failed to mark as reviewed"),
        color: "red",
      });
    }
  };

  if (data.status === "ok") {
    return (
      <Badge color="green" variant="light" radius="sm" mb="md">
        {data.setting.nextReviewAt
          ? t("Review up to date · next {{date}}", {
              date: formattedDate(new Date(data.setting.nextReviewAt)),
            })
          : t("Review up to date")}
      </Badge>
    );
  }

  const isOverdue = data.status === "overdue";

  return (
    <Alert
      color={isOverdue ? "red" : "yellow"}
      variant="light"
      radius="sm"
      mb="md"
      icon={<IconCalendarClock size={18} />}
      styles={{ wrapper: { alignItems: "center" } }}
    >
      <Group justify="space-between" wrap="wrap" gap="sm">
        <Text size="sm" style={{ flex: 1, minWidth: 0 }}>
          {isOverdue
            ? t("Review overdue — this page needs to be reviewed.")
            : t("Review due soon — this page should be reviewed.")}
          {data.setting.nextReviewAt &&
            ` (${t("Next review: {{date}}", {
              date: formattedDate(new Date(data.setting.nextReviewAt)),
            })})`}
        </Text>
        {canReview && (
          <Button
            size="xs"
            variant="light"
            color={isOverdue ? "red" : "yellow"}
            onClick={handleMarkReviewed}
            loading={markReviewedMutation.isPending}
          >
            {t("Mark as reviewed")}
          </Button>
        )}
      </Group>
    </Alert>
  );
}
