import { useState } from "react";
import {
  Alert,
  Button,
  Group,
  Modal,
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
  submit: "blue",
  take_for_review: "violet",
  approve: "teal",
  reject: "red",
  assign_to_self: "orange",
  submit_for_verification: "blue",
  reject_implementation: "red",
  publish: "green",
  close: "dark",
  cancel: "red",
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
  const [opened, { open, close }] = useDisclosure(false);

  if (isLoading || !data?.actions.length) return null;

  const handleClick = (t: AvailableTransition) => {
    if (t.requiresReason) {
      setPending(t);
      setReason("");
      open();
    } else {
      transition.mutate({ id: cr.id, action: t.action, rowVersion: cr.rowVersion });
    }
  };

  const handleConfirm = () => {
    if (!pending) return;
    transition.mutate(
      { id: cr.id, action: pending.action, reason, rowVersion: cr.rowVersion },
      { onSuccess: close },
    );
  };

  return (
    <>
      <Group gap="xs" wrap="wrap">
        {data.actions.map((act) => (
          <Button
            key={act.action}
            size="sm"
            color={ACTION_COLORS[act.action] ?? "blue"}
            variant={act.action === "reject" || act.action === "cancel" ? "outline" : "filled"}
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
          {(transition.error as any)?.response?.data?.message ??
            t("Transition failed. Please try again.")}
        </Alert>
      )}

      <Modal
        opened={opened}
        onClose={close}
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
          <Group justify="flex-end">
            <Button variant="default" onClick={close}>
              {t("Cancel")}
            </Button>
            <Button
              color={pending ? (ACTION_COLORS[pending.action] ?? "blue") : "blue"}
              disabled={!reason.trim()}
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
