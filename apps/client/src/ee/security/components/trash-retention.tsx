import { useState, useEffect } from "react";
import {
  Group,
  Text,
  NumberInput,
  Select,
  Button,
  Tooltip,
} from "@mantine/core";
import { useAtom } from "jotai";
import { workspaceAtom } from "@/features/user/atoms/current-user-atom.ts";
import { useTranslation } from "react-i18next";
import { updateWorkspace } from "@/features/workspace/services/workspace-service.ts";
import { notifications } from "@mantine/notifications";
import useEnterpriseAccess from "@/ee/hooks/use-enterprise-access.tsx";

type RetentionUnit = "days" | "months" | "years";

const DEFAULT_RETENTION_DAYS = 30;

function daysToRetention(days: number): { amount: number; unit: RetentionUnit } {
  if (days >= 365 && days % 365 === 0) {
    return { amount: days / 365, unit: "years" };
  }
  if (days >= 30 && days % 30 === 0) {
    return { amount: days / 30, unit: "months" };
  }
  return { amount: days, unit: "days" };
}

function retentionToDays(amount: number, unit: RetentionUnit): number {
  if (unit === "years") return amount * 365;
  if (unit === "months") return amount * 30;
  return amount;
}

export default function TrashRetention() {
  const { t } = useTranslation();
  const hasAccess = useEnterpriseAccess();
  const [workspace, setWorkspace] = useAtom(workspaceAtom);

  const currentDays = workspace?.trashRetentionDays ?? DEFAULT_RETENTION_DAYS;
  const parsed = daysToRetention(currentDays);

  const [retentionAmount, setRetentionAmount] = useState<number | string>(parsed.amount);
  const [retentionUnit, setRetentionUnit] = useState<RetentionUnit>(parsed.unit);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const days = workspace?.trashRetentionDays ?? DEFAULT_RETENTION_DAYS;
    const { amount, unit } = daysToRetention(days);
    setRetentionAmount(amount);
    setRetentionUnit(unit);
  }, [workspace?.trashRetentionDays]);

  const handleSave = async () => {
    const num = typeof retentionAmount === "number" ? retentionAmount : 1;
    const clamped = Math.max(1, num);
    setRetentionAmount(clamped);
    const days = retentionToDays(clamped, retentionUnit);

    if (days === currentDays) return;

    setSaving(true);
    try {
      const updatedWorkspace = await updateWorkspace({ trashRetentionDays: days });
      setWorkspace(updatedWorkspace);
      notifications.show({
        message: t("Trash retention updated"),
      });
    } catch (err: any) {
      notifications.show({
        message: err?.response?.data?.message || t("Failed to update trash retention"),
        color: "red",
      });
      const { amount, unit } = daysToRetention(currentDays);
      setRetentionAmount(amount);
      setRetentionUnit(unit);
    } finally {
      setSaving(false);
    }
  };

  const isDirty = retentionToDays(
    typeof retentionAmount === "number" ? retentionAmount : 1,
    retentionUnit,
  ) !== currentDays;

  return (
    <div>
      <Text size="md">{t("Trash retention")}</Text>
      <Text size="sm" c="dimmed" mb="sm">
        {t("Pages in trash will be permanently deleted after this period.")}
      </Text>

      <Tooltip
        label={t("Requires an enterprise license")}
        disabled={hasAccess}
      >
        <Group gap="xs" wrap="nowrap" maw={320}>
          <NumberInput
            value={retentionAmount}
            onChange={(val) => setRetentionAmount(val)}
            min={1}
            hideControls
            size="sm"
            w={60}
            disabled={!hasAccess}
          />
          <Select
            data={[
              { value: "days", label: t("days") },
              { value: "months", label: t("months") },
              { value: "years", label: t("years") },
            ]}
            value={retentionUnit}
            onChange={(value) => {
              if (value === "days" || value === "months" || value === "years") {
                setRetentionUnit(value);
              }
            }}
            size="sm"
            style={{ flex: 1 }}
            disabled={!hasAccess}
          />
          <Button
            size="sm"
            onClick={handleSave}
            loading={saving}
            disabled={!hasAccess || !isDirty}
          >
            {t("Save")}
          </Button>
        </Group>
      </Tooltip>
    </div>
  );
}
