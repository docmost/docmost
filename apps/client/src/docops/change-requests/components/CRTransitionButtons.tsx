import { useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Group,
  Modal,
  SegmentedControl,
  Select,
  Stack,
  Text,
  TextInput,
  Textarea,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useTranslation } from "react-i18next";
import { useAvailableTransitions } from "../hooks/useAvailableTransitions";
import { useTransitionMutation } from "../hooks/useChangeRequests";
import type { AvailableTransition, ChangeRequest } from "../types/cr.types";
import { bumpVersion, isValidSemVer, type BumpType } from "../utils/semver.util";

const ACTION_COLORS: Record<string, string> = {
  approve: 'teal',
  verify: 'blue',
  assign_to_self: 'orange',
  publish: 'green',
  close: 'red',
};

interface CRTransitionButtonsProps {
  cr: ChangeRequest;
}

export function CRTransitionButtons({ cr }: CRTransitionButtonsProps) {
  const { t } = useTranslation();
  const { data, isLoading } = useAvailableTransitions(cr.id);
  const transition = useTransitionMutation(cr.id);

  // Generic reason modal state
  const [pending, setPending] = useState<AvailableTransition | null>(null);
  const [reason, setReason] = useState("");
  const [closeReason, setCloseReason] = useState<'REJECTED' | 'CANCELLED' | null>(null);
  const [opened, { open, close }] = useDisclosure(false);

  // Publish / SemVer modal state
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [bumpType, setBumpType] = useState<BumpType>('patch');
  const [customVersion, setCustomVersion] = useState('');
  const [useCustom, setUseCustom] = useState(false);

  const currentVersion = cr.serviceDocVersion ?? '0.0.0';
  const suggestedVersion = bumpVersion(currentVersion, bumpType);
  const finalVersion = useCustom ? customVersion : suggestedVersion;
  const versionError =
    useCustom && customVersion && !isValidSemVer(customVersion)
      ? t('Formato non valido. Usa X.Y.Z (es. 1.2.3)')
      : null;

  if (isLoading || !data?.actions.length) return null;

  const handleClick = (act: AvailableTransition) => {
    if (act.action === 'publish') {
      setBumpType('patch');
      setCustomVersion('');
      setUseCustom(false);
      setPublishModalOpen(true);
    } else if (act.requiresReason) {
      setPending(act);
      setReason("");
      setCloseReason(null);
      open();
    } else {
      transition.mutate({ id: cr.id, action: act.action, rowVersion: cr.rowVersion });
    }
  };

  const handleConfirm = () => {
    if (!pending) return;
    transition.mutate(
      {
        id: cr.id,
        action: pending.action,
        reason,
        closeReason: pending.action === 'close' && closeReason ? closeReason : undefined,
        rowVersion: cr.rowVersion,
      },
      { onSuccess: handleModalClose },
    );
  };

  const handleModalClose = () => {
    close();
    setPending(null);
    setReason('');
    setCloseReason(null);
  };

  const handlePublishConfirm = () => {
    transition.mutate(
      { id: cr.id, action: 'publish', rowVersion: cr.rowVersion, docVersion: finalVersion },
      { onSuccess: () => setPublishModalOpen(false) },
    );
  };

  const handlePublishClose = () => {
    setPublishModalOpen(false);
    setBumpType('patch');
    setCustomVersion('');
    setUseCustom(false);
  };

  return (
    <>
      <Group gap="xs" wrap="wrap">
        {data.actions.map((act) => (
          <Button
            key={act.action}
            size="sm"
            color={ACTION_COLORS[act.action] ?? "blue"}
            variant={act.action === "close" ? "outline" : "filled"}
            loading={transition.isPending && !opened && !publishModalOpen}
            onClick={() => handleClick(act)}
            aria-label={t(`action.${act.action}`)}
          >
            {t(`action.${act.action}`)}
          </Button>
        ))}
      </Group>

      {transition.isError && (
        <Alert color="red" mt="xs">
          {t(
            (transition.error as any)?.response?.data?.message ??
              "Transition failed. Please try again.",
          )}
        </Alert>
      )}

      {/* Generic reason modal (approve, verify, close) */}
      <Modal
        opened={opened}
        onClose={handleModalClose}
        title={pending ? t(`action.${pending.action}`) : ""}
        centered
        size="md"
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            {t("This action requires a reason.")}
          </Text>
          <Textarea
            label={t("Reason (required)")}
            placeholder={t("Enter reason...")}
            minRows={3}
            required
            value={reason}
            onChange={(e) => setReason(e.currentTarget.value)}
            aria-label={t("Reason (required)")}
          />
          {pending?.action === 'close' && (
            <Select
              label={t("Close reason")}
              placeholder={t("Select reason...")}
              required
              data={[
                { value: 'REJECTED', label: t('REJECTED') },
                { value: 'CANCELLED', label: t('CANCELLED') },
              ]}
              value={closeReason}
              onChange={(v) => setCloseReason((v ?? '') as any)}
            />
          )}
          <Group justify="flex-end">
            <Button variant="default" onClick={handleModalClose}>
              {t("Cancel")}
            </Button>
            <Button
              color={pending ? (ACTION_COLORS[pending.action] ?? "blue") : "blue"}
              disabled={!reason.trim() || (pending?.action === 'close' && !closeReason)}
              loading={transition.isPending}
              onClick={handleConfirm}
            >
              {t("Confirm action")}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Publish / SemVer modal */}
      <Modal
        opened={publishModalOpen}
        onClose={handlePublishClose}
        title={t("Pubblica Change Request")}
        centered
        size="md"
      >
        <Stack gap="md">
          <Group gap="xs">
            <Text size="sm" c="dimmed">{t("Versione corrente")}:</Text>
            <Badge variant="outline" color="gray">{currentVersion}</Badge>
          </Group>

          <SegmentedControl
            fullWidth
            value={useCustom ? '__custom' : bumpType}
            onChange={(v) => {
              if (v === '__custom') {
                setUseCustom(true);
              } else {
                setUseCustom(false);
                setBumpType(v as BumpType);
              }
            }}
            data={[
              { label: `Patch  ${bumpVersion(currentVersion, 'patch')}`, value: 'patch' },
              { label: `Minor  ${bumpVersion(currentVersion, 'minor')}`, value: 'minor' },
              { label: `Major  ${bumpVersion(currentVersion, 'major')}`, value: 'major' },
              { label: t('Custom'), value: '__custom' },
            ]}
          />

          {useCustom && (
            <TextInput
              label={t("Versione personalizzata")}
              placeholder="es. 2.0.0"
              value={customVersion}
              onChange={(e) => setCustomVersion(e.currentTarget.value)}
              error={versionError}
            />
          )}

          <Group gap="xs">
            <Text size="sm">{t("Nuova versione")}:</Text>
            <Badge color="green" size="lg">{finalVersion || '—'}</Badge>
          </Group>

          <Group justify="flex-end">
            <Button variant="default" onClick={handlePublishClose}>
              {t("Cancel")}
            </Button>
            <Button
              color="green"
              disabled={!!versionError || (useCustom && !customVersion)}
              loading={transition.isPending}
              onClick={handlePublishConfirm}
            >
              {t("Pubblica")} {finalVersion}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
