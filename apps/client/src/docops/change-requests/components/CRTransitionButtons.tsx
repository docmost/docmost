import { useState } from "react";
import {
  Alert,
  Button,
  Group,
  Modal,
  Select,
  Stack,
  Text,
  Textarea,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useTranslation } from "react-i18next";
import { useAvailableTransitions } from "../hooks/useAvailableTransitions";
import { useTransitionMutation } from "../hooks/useChangeRequests";
import type { AvailableTransition, ChangeRequest } from "../types/cr.types";

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

  const [pending, setPending] = useState<AvailableTransition | null>(null);
  const [reason, setReason] = useState("");
  const [closeReason, setCloseReason] = useState<'REJECTED' | 'CANCELLED' | null>(null);
  const [opened, { open, close }] = useDisclosure(false);

  if (isLoading || !data?.actions.length) return null;

  const handleClick = (t: AvailableTransition) => {
    if (t.requiresReason) {
      setPending(t);
      setReason("");
      setCloseReason(null);
      open();
    } else {
      transition.mutate({ id: cr.id, action: t.action, rowVersion: cr.rowVersion });
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

  return (
    <>
      <Group gap="xs" wrap="wrap">
        {data.actions.map((act) => (
          <Button
            key={act.action}
            size="sm"
            color={ACTION_COLORS[act.action] ?? "blue"}
            variant={act.action === "close" ? "outline" : "filled"}
            loading={transition.isPending && !opened}
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
    </>
  );
}
