import {
  Alert,
  Badge,
  Button,
  Divider,
  Group,
  NumberInput,
  Stack,
  Switch,
  Text,
  Textarea,
} from "@mantine/core";
import { useEffect, useMemo, useState } from "react";
import { notifications } from "@mantine/notifications";
import { Trans, useTranslation } from "react-i18next";
import { formattedDate } from "@/lib/time.ts";
import {
  useMarkReviewedMutation,
  useReviewHistoryQuery,
  useReviewInfoQuery,
  useSetReviewMutation,
} from "@/features/compliance/queries/review-query.ts";
import {
  useChangeLogInfoQuery,
  useSetChangeLogSettingsMutation,
} from "@/features/compliance/queries/change-set-query.ts";
import {
  IComplianceScope,
  ReviewStatus,
} from "@/features/compliance/types/compliance.types.ts";

const statusColor: Record<ReviewStatus, string> = {
  ok: "green",
  due: "yellow",
  overdue: "red",
};

interface ReviewSettingsProps {
  pageId?: string;
  spaceId?: string;
  readOnly?: boolean;
  canReview?: boolean;
}

export default function ReviewSettings({
  pageId,
  spaceId,
  readOnly,
  canReview,
}: ReviewSettingsProps) {
  const { t } = useTranslation();
  const scope: IComplianceScope = useMemo(
    () => ({ pageId, spaceId }),
    [pageId, spaceId],
  );

  const { data } = useReviewInfoQuery(scope);
  const setReviewMutation = useSetReviewMutation();
  const markReviewedMutation = useMarkReviewedMutation();

  const { data: changeLogInfo } = useChangeLogInfoQuery(scope);
  const setChangeLogSettingsMutation = useSetChangeLogSettingsMutation();

  const handleToggleChangeLog = async (enabled: boolean) => {
    try {
      await setChangeLogSettingsMutation.mutateAsync({ ...scope, enabled });
      notifications.show({ message: t("Change log requirement updated") });
    } catch {
      notifications.show({
        message: t("Failed to update change log requirement"),
        color: "red",
      });
    }
  };

  const [intervalDays, setIntervalDays] = useState<number | string>(90);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (data?.setting?.intervalDays) {
      setIntervalDays(data.setting.intervalDays);
    }
  }, [data?.setting?.intervalDays]);

  const historyQuery = useReviewHistoryQuery(scope);
  const records = useMemo(
    () => historyQuery.data?.pages.flatMap((p) => p.items) ?? [],
    [historyQuery.data],
  );

  const statusLabel: Record<ReviewStatus, string> = {
    ok: t("Up to date"),
    due: t("Due soon"),
    overdue: t("Overdue"),
  };

  const handleSave = async () => {
    try {
      await setReviewMutation.mutateAsync({
        ...scope,
        intervalDays: Number(intervalDays),
      });
      notifications.show({ message: t("Review interval saved") });
    } catch {
      notifications.show({
        message: t("Failed to save review interval"),
        color: "red",
      });
    }
  };

  const handleMarkReviewed = async () => {
    try {
      await markReviewedMutation.mutateAsync({
        ...scope,
        note: note.trim() ? note.trim() : undefined,
      });
      setNote("");
      notifications.show({ message: t("Marked as reviewed") });
    } catch {
      notifications.show({
        message: t("Failed to mark as reviewed"),
        color: "red",
      });
    }
  };

  return (
    <Stack gap="sm">
      <Switch
        checked={changeLogInfo?.enabled ?? false}
        onChange={(event) =>
          handleToggleChangeLog(event.currentTarget.checked)
        }
        disabled={readOnly || changeLogInfo?.inherited}
        label={t("Require change log")}
        description={t(
          "When enabled, a change log entry must be documented whenever this section is edited.",
        )}
      />
      {changeLogInfo?.inherited && (
        <Alert color="blue" variant="light">
          {t(
            "The change log requirement is inherited from a parent page or space.",
          )}
        </Alert>
      )}

      <Divider my="xs" />

      <Text size="sm" c="dimmed">
        {t(
          "Set how often this section must be reviewed to keep its documentation up to date.",
        )}
      </Text>

      {data?.inherited && (
        <Alert color="blue" variant="light">
          {t("A review interval is currently inherited from a parent page or space.")}
        </Alert>
      )}

      <Group align="flex-end" gap="sm">
        <NumberInput
          label={t("Review interval (days)")}
          min={1}
          max={3650}
          value={intervalDays}
          onChange={setIntervalDays}
          disabled={readOnly}
          w={200}
        />
        {!readOnly && (
          <Button onClick={handleSave} loading={setReviewMutation.isPending}>
            {t("Save")}
          </Button>
        )}
      </Group>

      {data?.setting && data.status && (
        <Group gap="xs">
          <Text size="sm">{t("Status")}:</Text>
          <Badge color={statusColor[data.status]} variant="light">
            {statusLabel[data.status]}
          </Badge>
          {data.setting.nextReviewAt && (
            <Text size="sm" c="dimmed">
              {t("Next review: {{date}}", {
                date: formattedDate(new Date(data.setting.nextReviewAt)),
              })}
            </Text>
          )}
        </Group>
      )}

      {data?.setting?.lastReviewedAt && (
        <Text size="xs" c="dimmed">
          <Trans
            defaults="Last reviewed by <b>{{name}}</b> on {{date}}"
            values={{
              name: data.setting.lastReviewedBy?.name ?? t("Someone"),
              date: formattedDate(new Date(data.setting.lastReviewedAt)),
            }}
            components={{ b: <Text span fw={500} inherit /> }}
          />
        </Text>
      )}

      {canReview && data?.setting && !data.inherited && (
        <>
          <Textarea
            label={t("Review note (optional)")}
            autosize
            minRows={1}
            value={note}
            onChange={(event) => setNote(event.currentTarget.value)}
          />
          <Button
            variant="light"
            onClick={handleMarkReviewed}
            loading={markReviewedMutation.isPending}
            style={{ alignSelf: "flex-start" }}
          >
            {t("Mark as reviewed")}
          </Button>
        </>
      )}

      {records.length > 0 && (
        <>
          <Divider my="xs" label={t("Review history")} labelPosition="left" />
          <Stack gap={4}>
            {records.map((record) => (
              <Text key={record.id} size="xs" c="dimmed">
                <Trans
                  defaults="<b>{{name}}</b> reviewed on {{date}}"
                  values={{
                    name: record.reviewedBy?.name ?? t("Someone"),
                    date: formattedDate(new Date(record.reviewedAt)),
                  }}
                  components={{ b: <Text span fw={500} inherit /> }}
                />
                {record.note ? ` — ${record.note}` : ""}
              </Text>
            ))}
          </Stack>
        </>
      )}
    </Stack>
  );
}
