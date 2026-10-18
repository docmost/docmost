import { useState } from "react";
import {
  Button,
  Center,
  Checkbox,
  Divider,
  Group,
  Loader,
  Stack,
  Text,
} from "@mantine/core";
import { modals } from "@mantine/modals";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n.ts";
import {
  usePageVerificationInfoQuery,
  useRemoveVerificationMutation,
  useUpdateVerificationMutation,
  useVerifyPageMutation,
} from "@/ee/page-verification/queries/page-verification-query";
import {
  ExpirationMode,
  IPageVerificationInfo,
  PeriodUnit,
} from "@/ee/page-verification/types/page-verification.types";
import { useTimeAgo } from "@/hooks/use-time-ago";
import { VerifierList } from "./verifier-list";
import {
  ExpirationFields,
  PERIOD_AMOUNT_MIN,
  PERIOD_UNIT_MAX_AMOUNT,
  toLocalDateString,
} from "./expiration-fields";
import { VerifierPicker } from "./verifier-picker";
import { MAX_VERIFIERS } from "./user-option";
import { QmsManageContent } from "./qms-manage-content";

type ManageVerificationFormProps = {
  pageId: string;
  onClose: () => void;
};

export function ManageVerificationForm({
  pageId,
  onClose,
}: ManageVerificationFormProps) {
  const { data: info, isLoading } = usePageVerificationInfoQuery(pageId);

  if (isLoading || !info) {
    return (
      <Center py="xl">
        <Loader size="sm" />
      </Center>
    );
  }

  if (info.type === "qms") {
    return <QmsManageContent pageId={pageId} info={info} onClose={onClose} />;
  }

  return (
    <ExpiringManageContent pageId={pageId} info={info} onClose={onClose} />
  );
}

type ManageContentProps = {
  pageId: string;
  info: IPageVerificationInfo;
  onClose: () => void;
};

function ExpiringManageContent({ pageId, info, onClose }: ManageContentProps) {
  const { t } = useTranslation();
  const verifyMutation = useVerifyPageMutation();
  const removeMutation = useRemoveVerificationMutation();
  const updateMutation = useUpdateVerificationMutation();
  const [confirmed, setConfirmed] = useState(false);

  const initialMode: ExpirationMode = (info.mode as ExpirationMode) ?? "period";
  const initialPeriodAmount = info.periodAmount ?? 1;
  const initialPeriodUnit: PeriodUnit =
    (info.periodUnit as PeriodUnit) ?? "month";
  const initialFixedDate =
    initialMode === "fixed" && info.expiresAt
      ? toLocalDateString(info.expiresAt)
      : "";

  const [mode, setMode] = useState<ExpirationMode>(initialMode);
  const [periodAmount, setPeriodAmount] = useState<number>(initialPeriodAmount);
  const [periodUnit, setPeriodUnit] = useState<PeriodUnit>(initialPeriodUnit);
  const [fixedDate, setFixedDate] = useState<string>(initialFixedDate);

  const verifiedAtAgo = useTimeAgo(info.verifiedAt ?? new Date().toISOString());

  const hasExpirationChange =
    mode !== initialMode ||
    (mode === "period" &&
      (periodAmount !== initialPeriodAmount ||
        periodUnit !== initialPeriodUnit)) ||
    (mode === "fixed" && fixedDate !== initialFixedDate);

  const periodValid =
    mode !== "period" ||
    (Number.isInteger(periodAmount) &&
      periodAmount >= PERIOD_AMOUNT_MIN &&
      periodAmount <= PERIOD_UNIT_MAX_AMOUNT[periodUnit]);
  const fixedDateValid =
    mode !== "fixed" ||
    (!!fixedDate && new Date(fixedDate).getTime() > Date.now());
  const canSaveExpiration = hasExpirationChange && periodValid && fixedDateValid;

  const storedFixedExpired =
    info.mode === "fixed" &&
    !!info.expiresAt &&
    new Date(info.expiresAt).getTime() <= Date.now();

  const existingVerifierIds = info.verifiers?.map((v) => v.id) ?? [];

  const handleVerify = () => {
    verifyMutation.mutate(
      { pageId },
      {
        onSuccess: () => {
          setConfirmed(false);
          onClose();
        },
      },
    );
  };

  const handleRemove = () => {
    modals.openConfirmModal({
      title: t("Remove verification"),
      children: (
        <Text size="sm">
          {t("Are you sure you want to remove verification from this page?")}
        </Text>
      ),
      labels: { confirm: t("Remove"), cancel: t("Cancel") },
      confirmProps: { color: "red" },
      onConfirm: () =>
        removeMutation.mutate({ pageId }, { onSuccess: onClose }),
    });
  };

  const handleSaveExpiration = () => {
    if (!canSaveExpiration) return;
    updateMutation.mutate({
      pageId,
      mode,
      ...(mode === "period" && {
        periodAmount,
        periodUnit,
      }),
      ...(mode === "fixed" &&
        fixedDate && {
          fixedExpiresAt: new Date(fixedDate).toISOString(),
        }),
    });
  };

  const handleRemoveVerifier = (userId: string) => {
    if (!info.verifiers) return;
    const remaining = info.verifiers
      .filter((v) => v.id !== userId)
      .map((v) => v.id);
    updateMutation.mutate({ pageId, verifierIds: remaining });
  };

  const handleAddVerifier = (userId: string) => {
    if (!info.verifiers) return;
    if (info.verifiers.some((v) => v.id === userId)) return;
    const verifierIds = [...info.verifiers.map((v) => v.id), userId];
    updateMutation.mutate({ pageId, verifierIds });
  };

  const status = info.status;

  return (
    <Stack>
      <Text size="sm" c="dimmed">
        {t("Assigned verifiers must periodically re-verify this page.")}
      </Text>

      {info.verifiedBy && (
        <Group gap="sm">
          <div>
            <Text size="sm">
              {status === "expired"
                ? t("Last verified by {{name}} {{time}} (expired)", {
                    name: info.verifiedBy.name,
                    time: verifiedAtAgo,
                  })
                : t("Verified by {{name}} {{time}}", {
                    name: info.verifiedBy.name,
                    time: verifiedAtAgo,
                  })}
            </Text>
            {info.expiresAt && (
              <Text size="xs" c="dimmed">
                {t(status === "expired" ? "Expired {{date}}" : "Expires {{date}}", {
                  date: new Date(info.expiresAt).toLocaleDateString(
                    i18n.language,
                    {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    },
                  ),
                })}
              </Text>
            )}
          </div>
        </Group>
      )}

      <Divider />

      {info.verifiers && info.verifiers.length > 0 && (
        <>
          <div>
            <Text size="sm" fw={600} tt="uppercase" c="dimmed" mb={4}>
              {t("Verifiers")}
            </Text>
            <VerifierList
              verifiers={info.verifiers}
              canManage={info.permissions?.canManage}
              onRemove={
                info.permissions?.canManage ? handleRemoveVerifier : undefined
              }
            />
            {info.permissions?.canManage &&
              info.verifiers.length < MAX_VERIFIERS && (
                <div style={{ marginTop: "var(--mantine-spacing-xs)" }}>
                  <VerifierPicker
                    excludeIds={existingVerifierIds}
                    onSelect={(user) => handleAddVerifier(user.value)}
                  />
                </div>
              )}
          </div>
          <Divider />
        </>
      )}

      {info.permissions?.canManage && (
        <>
          <div>
            <Text size="sm" fw={600} mb={6}>
              {t("Expiration")}
            </Text>
            <ExpirationFields
              mode={mode}
              periodAmount={periodAmount}
              periodUnit={periodUnit}
              fixedDate={fixedDate}
              onModeChange={setMode}
              onPeriodAmountChange={setPeriodAmount}
              onPeriodUnitChange={setPeriodUnit}
              onFixedDateChange={setFixedDate}
              baseDate={
                info.verifiedAt ? new Date(info.verifiedAt) : undefined
              }
            />
            {hasExpirationChange && (
              <Button
                size="compact-sm"
                mt="xs"
                color="dark"
                onClick={handleSaveExpiration}
                loading={updateMutation.isPending}
                disabled={!canSaveExpiration}
              >
                {t("Save")}
              </Button>
            )}
          </div>
          <Divider />
        </>
      )}

      {info.permissions?.canVerify && (
        <div>
          <Text size="sm" fw={600} mb={4}>
            {t("Confirm")}
          </Text>
          <Checkbox
            label={t("I've reviewed this page for accuracy")}
            checked={confirmed}
            onChange={(event) => setConfirmed(event.currentTarget.checked)}
            color="dark"
          />
          {storedFixedExpired && (
            <Text size="xs" c="red" mt={6}>
              {t("The fixed expiration date has passed.")}
            </Text>
          )}
        </div>
      )}

      <Group justify="space-between">
        {info.permissions?.canManage && (
          <Button
            variant="subtle"
            color="red"
            size="compact-sm"
            onClick={handleRemove}
            loading={removeMutation.isPending}
          >
            {t("Remove verification")}
          </Button>
        )}

        {info.permissions?.canVerify && (
          <Button
            onClick={handleVerify}
            disabled={!confirmed || storedFixedExpired}
            loading={verifyMutation.isPending}
            color={status === "expired" ? "red" : "dark"}
            ml="auto"
          >
            {t("Verify")}
          </Button>
        )}
      </Group>
    </Stack>
  );
}
