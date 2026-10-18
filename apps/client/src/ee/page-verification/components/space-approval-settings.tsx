import { ChangeEvent, useEffect, useState } from "react";
import { Group, Stack, Switch, Text, Title, Tooltip } from "@mantine/core";
import { modals } from "@mantine/modals";
import { useTranslation } from "react-i18next";
import { ISpace } from "@/features/space/types/space.types";
import { useHasFeature } from "@/ee/hooks/use-feature";
import { Feature } from "@/ee/features";
import { useUpgradeLabel } from "@/ee/hooks/use-upgrade-label";
import {
  useSpaceApprovalSettingsQuery,
  useUpdateSpaceApprovalSettingsMutation,
} from "@/ee/page-verification/queries/page-verification-query";
import type { IVerifier } from "@/ee/page-verification/types/page-verification.types";
import { VerifierList } from "./verifier-list";
import { VerifierPicker } from "./verifier-picker";
import { MAX_VERIFIERS, UserOptionItem } from "./user-option";

type SpaceApprovalSettingsProps = {
  space: ISpace;
};

export default function SpaceApprovalSettings({
  space,
}: SpaceApprovalSettingsProps) {
  const { t } = useTranslation();
  const hasFeature = useHasFeature(Feature.PAGE_VERIFICATION);
  const upgradeLabel = useUpgradeLabel();
  const { data } = useSpaceApprovalSettingsQuery(
    hasFeature ? space?.id : undefined,
  );
  const updateMutation = useUpdateSpaceApprovalSettingsMutation();
  // Approvers picked before approval is turned on; null until the admin picks one.
  const [pickedApprovers, setPickedApprovers] = useState<IVerifier[] | null>(
    null,
  );

  const stored = space?.settings?.approval;
  const enabled = data?.enabled ?? stored?.enabled === true;
  // A disable that stopped halfway still counts as on until it is run again.
  const disabling = stored?.disabling === true;
  const checked = enabled || disabling;
  const approvers = checked
    ? (data?.approvers ?? [])
    : (pickedApprovers ?? data?.approvers ?? []);

  useEffect(() => {
    setPickedApprovers(null);
  }, [checked]);

  const approverIds = approvers.length
    ? approvers.map((approver) => approver.id)
    : (stored?.approverIds ?? []);

  // Turning approval off is always possible, so a lapsed licence cannot trap a space.
  const switchDisabled = checked
    ? updateMutation.isPending
    : !hasFeature || approvers.length === 0 || updateMutation.isPending;
  const tooltipLabel = !hasFeature
    ? upgradeLabel
    : t("Add at least one approver first");

  const handleToggle = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.currentTarget.checked;

    modals.openConfirmModal({
      title: next
        ? t("Require approval for this space")
        : t("Turn off approval for this space"),
      centered: true,
      children: next ? (
        <Stack gap="xs">
          <Text size="sm">
            {t(
              "Current content of every page becomes the starting version readers see.",
            )}
          </Text>
          <Text size="sm">
            {t("Edits are saved as drafts until an approver approves them.")}
          </Text>
        </Stack>
      ) : (
        <Text size="sm">
          {t("Every draft in this space is published as it is.")}
        </Text>
      ),
      labels: { confirm: t("Confirm"), cancel: t("Cancel") },
      confirmProps: next ? {} : { color: "red" },
      onConfirm: () =>
        updateMutation.mutate({ spaceId: space.id, enabled: next, approverIds }),
    });
  };

  // Approvers save as they change while approval is on; before that they wait for the switch.
  const saveApprovers = (next: IVerifier[]) => {
    if (!checked) {
      setPickedApprovers(next);
      return;
    }
    updateMutation.mutate({
      spaceId: space.id,
      enabled: true,
      approverIds: next.map((approver) => approver.id),
    });
  };

  const handleAddApprover = (user: UserOptionItem) => {
    if (approvers.some((approver) => approver.id === user.value)) return;
    saveApprovers([
      ...approvers,
      {
        id: user.value,
        name: user.label,
        email: user.email,
        avatarUrl: user.avatarUrl,
      },
    ]);
  };

  const handleRemoveApprover = (userId: string) => {
    saveApprovers(approvers.filter((approver) => approver.id !== userId));
  };

  // Approval needs at least one approver, so the last one stays while it is on.
  const canRemoveApprovers = !checked || approvers.length > 1;

  return (
    <div>
      <Group justify="space-between" wrap="nowrap" gap="xl">
        <div>
          <Text size="md">{t("Require approval")}</Text>
          <Text size="sm" c="dimmed">
            {t(
              "Readers only see approved versions of pages. Editors work on drafts until an approver approves them.",
            )}
          </Text>
          {disabling && (
            <Text size="sm" c="red.7" mt={4}>
              {t(
                "Turning off approval did not finish. Turn it off again to publish the remaining drafts.",
              )}
            </Text>
          )}
        </div>
        <Tooltip
          label={tooltipLabel}
          disabled={checked || (hasFeature && approvers.length > 0)}
          refProp="rootRef"
        >
          <Switch
            checked={checked}
            onChange={handleToggle}
            disabled={switchDisabled}
            size="xs"
            aria-label={t("Toggle approval for this space")}
          />
        </Tooltip>
      </Group>

      {hasFeature && (
        <div style={{ marginTop: "var(--mantine-spacing-md)" }}>
          <Title order={4} size="h6" fw={600} mb={4}>
            {t("Approvers")}
          </Title>
          <Text size="sm" c="dimmed" mb="xs">
            {checked
              ? t("At least one approver is required while approval is on.")
              : t("Choose who approves pages before turning approval on.")}
          </Text>
          <VerifierList
            verifiers={approvers}
            canManage={canRemoveApprovers}
            onRemove={canRemoveApprovers ? handleRemoveApprover : undefined}
          />
          {approvers.length < MAX_VERIFIERS && (
            <div style={{ marginTop: "var(--mantine-spacing-xs)" }}>
              <VerifierPicker
                excludeIds={approvers.map((approver) => approver.id)}
                onSelect={handleAddApprover}
                disabled={updateMutation.isPending}
                placeholder={t("Add approver")}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
