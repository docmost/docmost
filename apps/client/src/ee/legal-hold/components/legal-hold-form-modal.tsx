import { useRef } from "react";
import {
  Alert,
  Button,
  Group,
  Modal,
  Skeleton,
  Stack,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { zod4Resolver } from "mantine-form-zod-resolver";
import { IconAlertCircle } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { getApiErrorMessage } from "@/lib/api-error";
import { CustodianMultiSelect } from "@/ee/legal-hold/components/custodian-multi-select";
import { SpaceMultiSelect } from "@/ee/legal-hold/components/space-multi-select";
import {
  LEGAL_HOLD_DESCRIPTION_MAX_LENGTH,
  LEGAL_HOLD_NAME_MAX_LENGTH,
  legalHoldFormSchema,
  type LegalHoldFormValues,
} from "@/ee/legal-hold/legal-hold.utils";
import {
  useCreateLegalHoldMutation,
  useLegalHoldQuery,
  useUpdateLegalHoldMutation,
} from "@/ee/legal-hold/queries/legal-hold-query";
import type { LegalHoldDetail } from "@/ee/legal-hold/types/legal-hold.types";

type LegalHoldFormModalProps = {
  opened: boolean;
  onClose: () => void;
  onExitTransitionEnd?: () => void;
  onCreated?: (legalHold: LegalHoldDetail) => void;
  // null creates a new hold
  legalHoldId: string | null;
};

export function LegalHoldFormModal({
  opened,
  onClose,
  onExitTransitionEnd,
  onCreated,
  legalHoldId,
}: LegalHoldFormModalProps) {
  const { t } = useTranslation();
  const legalHoldQuery = useLegalHoldQuery(legalHoldId);
  const legalHold = legalHoldId ? legalHoldQuery.data : null;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      onExitTransitionEnd={onExitTransitionEnd}
      title={legalHoldId ? t("Edit legal hold") : t("New legal hold")}
      size="lg"
      closeButtonProps={{ "aria-label": t("Close") }}
    >
      {legalHold === undefined ? (
        legalHoldQuery.isError ? (
          <Alert color="red" icon={<IconAlertCircle size={16} />}>
            {getApiErrorMessage(
              legalHoldQuery.error,
              t("Failed to load legal hold"),
            )}
          </Alert>
        ) : (
          <FormSkeleton />
        )
      ) : (
        <LegalHoldForm
          key={legalHold?.id ?? "new"}
          legalHold={legalHold}
          onClose={onClose}
          onCreated={onCreated}
        />
      )}
    </Modal>
  );
}

function FormSkeleton() {
  return (
    <Stack gap="md" aria-busy>
      {[36, 60, 36, 36].map((height, index) => (
        <div key={index}>
          <Skeleton height={14} width={90} mb={8} />
          <Skeleton height={height} radius="sm" />
        </div>
      ))}
      <Group justify="flex-end" mt="md">
        <Skeleton height={36} width={80} radius="sm" />
        <Skeleton height={36} width={80} radius="sm" />
      </Group>
    </Stack>
  );
}

type LegalHoldFormProps = {
  legalHold: LegalHoldDetail | null;
  onClose: () => void;
  onCreated?: (legalHold: LegalHoldDetail) => void;
};

function sameIds(a: string[], b: string[]): boolean {
  const ids = new Set(a);
  return a.length === b.length && b.every((id) => ids.has(id));
}

function LegalHoldForm({ legalHold, onClose, onCreated }: LegalHoldFormProps) {
  const { t } = useTranslation();
  const formRef = useRef<HTMLFormElement>(null);
  const createMutation = useCreateLegalHoldMutation();
  const updateMutation = useUpdateLegalHoldMutation();
  const mutation = legalHold ? updateMutation : createMutation;

  const initialUserIds = legalHold?.custodians.map((user) => user.id) ?? [];
  const initialSpaceIds = legalHold?.spaces.map((space) => space.id) ?? [];

  const form = useForm<LegalHoldFormValues>({
    validate: zod4Resolver(legalHoldFormSchema),
    initialValues: {
      name: legalHold?.name ?? "",
      description: legalHold?.description ?? "",
      userIds: initialUserIds,
      spaceIds: initialSpaceIds,
    },
  });

  const handleValidationFailure = () => {
    // Wait for the errors to render so aria-invalid is set
    setTimeout(() => {
      formRef.current
        ?.querySelector<HTMLElement>('[aria-invalid="true"]')
        ?.focus();
    }, 0);
  };

  const handleSubmit = async (values: LegalHoldFormValues) => {
    const name = values.name.trim();
    const description = values.description.trim();
    try {
      if (legalHold) {
        // Unchanged lists stay out, so custodians or spaces deleted since are not checked again
        await updateMutation.mutateAsync({
          legalHoldId: legalHold.id,
          name,
          description,
          ...(sameIds(values.userIds, initialUserIds)
            ? {}
            : { userIds: values.userIds }),
          ...(sameIds(values.spaceIds, initialSpaceIds)
            ? {}
            : { spaceIds: values.spaceIds }),
        });
      } else {
        const created = await createMutation.mutateAsync({
          name,
          description,
          userIds: values.userIds,
          spaceIds: values.spaceIds,
        });
        onCreated?.(created);
      }
      onClose();
    } catch {
      // the alert below shows the error
    }
  };

  const nameError = form.errors.name;
  const scopeError = form.errors.userIds;

  return (
    <form
      ref={formRef}
      onSubmit={form.onSubmit(handleSubmit, handleValidationFailure)}
    >
      <Stack gap="md">
        <TextInput
          label={t("Name")}
          placeholder={t("Contract dispute 2026")}
          withAsterisk
          data-autofocus
          maxLength={LEGAL_HOLD_NAME_MAX_LENGTH}
          {...form.getInputProps("name")}
          error={nameError && t(nameError as string)}
        />

        <Textarea
          label={t("Description")}
          placeholder={t("Matter, case number or reason")}
          autosize
          minRows={2}
          maxRows={6}
          maxLength={LEGAL_HOLD_DESCRIPTION_MAX_LENGTH}
          {...form.getInputProps("description")}
        />

        <CustodianMultiSelect
          value={form.values.userIds}
          onChange={(ids) => form.setFieldValue("userIds", ids)}
          initialCustodians={legalHold?.custodians ?? []}
          error={scopeError && t(scopeError as string)}
        />

        <SpaceMultiSelect
          value={form.values.spaceIds}
          onChange={(ids) => {
            form.setFieldValue("spaceIds", ids);
            form.clearFieldError("userIds");
          }}
          initialSpaces={legalHold?.spaces ?? []}
        />

        <Text size="sm" c="dimmed">
          {t("Custodians aren't notified.")}
        </Text>

        {mutation.error && (
          <Alert color="red" icon={<IconAlertCircle size={16} />}>
            {getApiErrorMessage(
              mutation.error,
              legalHold
                ? t("Failed to update legal hold")
                : t("Failed to create legal hold"),
            )}
          </Alert>
        )}

        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={onClose}>
            {t("Cancel")}
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            {legalHold ? t("Save") : t("Create")}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
