import {
  type KeyboardEvent,
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Alert,
  Box,
  Button,
  ColorSwatch,
  Group,
  Input,
  List,
  Modal,
  Select,
  SimpleGrid,
  Skeleton,
  Stack,
  Switch,
  TextInput,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconAlertCircle, IconCheck } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { getApiErrorMessage } from "@/lib/api-error";
import { isCloud } from "@/lib/config.ts";
import {
  ANNOUNCEMENT_COLOR_STYLES,
  ANNOUNCEMENT_COLORS,
  ANNOUNCEMENT_MAX_TITLE_LENGTH,
  ANNOUNCEMENT_TYPE_DEFAULT_COLOR,
  ANNOUNCEMENT_TYPE_ICONS,
  ANNOUNCEMENT_TYPE_LABELS,
  ANNOUNCEMENT_TYPES,
} from "@/ee/announcement/announcement.constants";
import { getAnnouncementPlainText } from "@/ee/announcement/announcement.utils";
import { AnnouncementBanner } from "@/ee/announcement/components/announcement-banner";
import { AnnouncementConflictSummary } from "@/ee/announcement/components/announcement-conflict-summary";
import {
  type AnnouncementFormValues,
  formatPickerValue,
  getInitialValues,
  toAnnouncementInput,
  validateAnnouncementForm,
} from "@/ee/announcement/components/announcement-form.utils";
import { AnnouncementMessageEditor } from "@/ee/announcement/components/announcement-message-editor";
import {
  getAnnouncementLimitConflict,
  getAnnouncementReplacement,
  useCreateAnnouncementMutation,
  useUpdateAnnouncementMutation,
} from "@/ee/announcement/queries/announcement-query";
import type {
  AnnouncementAudience,
  AnnouncementType,
  IAnnouncement,
  IAnnouncementReplacement,
} from "@/ee/announcement/types/announcement.types";

const DateTimePicker = lazy(() =>
  import("@mantine/dates").then((module) => ({
    default: module.DateTimePicker,
  })),
);

const RADIO_KEY_STEPS: Record<string, number> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
};

type AnnouncementFormModalProps = {
  opened: boolean;
  onClose: () => void;
  announcement: IAnnouncement | null;
};

function moveRadioSelection(event: KeyboardEvent<HTMLButtonElement>) {
  const step = RADIO_KEY_STEPS[event.key];
  if (!step) {
    return;
  }
  event.preventDefault();
  const radios = Array.from(
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
      '[role="radio"]',
    ) ?? [],
  );
  const next =
    radios[(radios.indexOf(event.currentTarget) + step + radios.length) % radios.length];
  next.focus();
  next.click();
}

export function AnnouncementFormModal({
  opened,
  onClose,
  announcement,
}: AnnouncementFormModalProps) {
  const { t } = useTranslation();

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={announcement ? t("Edit announcement") : t("New announcement")}
      size="lg"
      closeButtonProps={{ "aria-label": t("Close") }}
    >
      <AnnouncementForm
        key={announcement?.id ?? "new"}
        announcement={announcement}
        onClose={onClose}
      />
    </Modal>
  );
}

type AnnouncementFormProps = {
  announcement: IAnnouncement | null;
  onClose: () => void;
};

function AnnouncementForm({ announcement, onClose }: AnnouncementFormProps) {
  const { t, i18n } = useTranslation();
  const alertRef = useRef<HTMLDivElement>(null);
  const noticeRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const createMutation = useCreateAnnouncementMutation();
  const updateMutation = useUpdateAnnouncementMutation();
  const mutation = announcement ? updateMutation : createMutation;
  const conflict = getAnnouncementLimitConflict(mutation.error);
  const [replacement, setReplacement] =
    useState<IAnnouncementReplacement | null>(null);

  const form = useForm<AnnouncementFormValues>({
    initialValues: getInitialValues(announcement),
    validate: (values) =>
      validateAnnouncementForm(values, announcement?.endsAt ?? null, t),
  });
  const { values } = form;
  const hasText =
    !!values.content && getAnnouncementPlainText(values.content).trim() !== "";
  const focusableColor = ANNOUNCEMENT_COLORS.includes(values.color)
    ? values.color
    : ANNOUNCEMENT_COLORS[0];
  const TypeIcon = ANNOUNCEMENT_TYPE_ICONS[values.type];

  useEffect(() => {
    if (mutation.error) {
      alertRef.current?.scrollIntoView?.({ block: "nearest" });
    }
  }, [mutation.error]);

  // The submit button sits below the fold, so the notice would stay out of sight
  useEffect(() => {
    if (replacement) {
      setTimeout(() => {
        noticeRef.current?.scrollIntoView?.({ block: "nearest" });
      }, 0);
    }
  }, [replacement]);

  const formatPickerTime = (value: string) =>
    formatPickerValue(value, i18n.language);

  const handleValidationFailure = () => {
    // Wait for the errors to render so aria-invalid is set
    setTimeout(() => {
      formRef.current
        ?.querySelector<HTMLElement>('[aria-invalid="true"]')
        ?.focus();
    }, 0);
  };

  const setTime = (field: "startsAt" | "endsAt", value: string | null) => {
    form.setFieldValue(field, value);
    setReplacement(null);
    mutation.reset();
  };

  const handleSubmit = async (submitted: AnnouncementFormValues) => {
    const input = toAnnouncementInput(submitted, announcement);
    if (replacement) {
      input.replace = true;
    }
    try {
      if (announcement) {
        await updateMutation.mutateAsync({
          ...input,
          announcementId: announcement.id,
        });
      } else {
        await createMutation.mutateAsync(input);
      }
      onClose();
    } catch (error) {
      setReplacement(getAnnouncementReplacement(error));
    }
  };

  return (
    <form
      ref={formRef}
      onSubmit={form.onSubmit(handleSubmit, handleValidationFailure)}
    >
      <Stack gap="md">
        {replacement && (
          <Alert
            ref={noticeRef}
            color="yellow"
            icon={<IconAlertCircle size={16} />}
          >
            <List size="sm" listStyleType="none">
              {replacement.replaces.map((item) => (
                <List.Item key={`replaces-${item.id}`}>
                  {t("“{{title}}” will be archived when this one starts.", {
                    title: item.title,
                  })}
                </List.Item>
              ))}
              {replacement.replacedBy.map((item) => (
                <List.Item key={`replaced-by-${item.id}`}>
                  {t("This one will be archived when “{{title}}” starts.", {
                    title: item.title,
                  })}
                </List.Item>
              ))}
            </List>
          </Alert>
        )}

        {mutation.error && !replacement && (
          <Alert
            ref={alertRef}
            color="red"
            icon={<IconAlertCircle size={16} />}
            title={
              conflict
                ? t("Only one announcement can show at a time.")
                : undefined
            }
          >
            {conflict ? (
              <AnnouncementConflictSummary conflict={conflict} />
            ) : (
              getApiErrorMessage(
                mutation.error,
                announcement
                  ? t("Failed to update announcement")
                  : t("Failed to create announcement"),
              )
            )}
          </Alert>
        )}

        <TextInput
          label={t("Title")}
          description={t("Not shown in the banner.")}
          withAsterisk
          maxLength={ANNOUNCEMENT_MAX_TITLE_LENGTH}
          {...form.getInputProps("title")}
        />

        <Select
          label={t("Type")}
          data={ANNOUNCEMENT_TYPES.map((type) => ({
            value: type,
            label: t(ANNOUNCEMENT_TYPE_LABELS[type]),
          }))}
          value={values.type}
          onChange={(value) => {
            const type = value as AnnouncementType;
            form.setValues({
              type,
              color: ANNOUNCEMENT_TYPE_DEFAULT_COLOR[type],
            });
          }}
          allowDeselect={false}
          leftSection={TypeIcon && <TypeIcon size={16} aria-hidden />}
        />

        <AnnouncementMessageEditor
          initialContent={announcement?.content ?? null}
          onChange={(content) => form.setFieldValue("content", content)}
          error={form.errors.content as string | undefined}
        />

        <Input.Wrapper label={t("Color")} labelElement="div">
          <Group gap="xs" role="radiogroup" aria-label={t("Color")}>
            {ANNOUNCEMENT_COLORS.map((color) => {
              const preset = ANNOUNCEMENT_COLOR_STYLES[color];
              const checked = values.color === color;
              return (
                <ColorSwatch
                  key={color}
                  component="button"
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  aria-label={t(preset.label)}
                  tabIndex={color === focusableColor ? 0 : -1}
                  color={preset.background}
                  style={{ cursor: "pointer" }}
                  onClick={() => form.setFieldValue("color", color)}
                  onKeyDown={moveRadioSelection}
                >
                  {checked && (
                    <IconCheck size={16} color={preset.text} aria-hidden />
                  )}
                </ColorSwatch>
              );
            })}
          </Group>
        </Input.Wrapper>

        {/* Cloud shows announcements to logged-in users only */}
        {!isCloud() && (
          <Select
            label={t("Audience")}
            description={t(
              "Everyone also includes the login page and public pages.",
            )}
            data={[
              { value: "members", label: t("Logged-in users") },
              { value: "everyone", label: t("Everyone") },
            ]}
            value={values.audience}
            onChange={(value) =>
              form.setFieldValue("audience", value as AnnouncementAudience)
            }
            allowDeselect={false}
          />
        )}

        <Switch
          label={t("Allow people to dismiss it")}
          checked={values.isDismissible}
          onChange={(event) =>
            form.setFieldValue("isDismissible", event.currentTarget.checked)
          }
        />

        <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="md">
          <Suspense
            fallback={
              <Input.Wrapper label={t("Starts")} labelElement="div">
                <Skeleton height={36} radius="sm" />
              </Input.Wrapper>
            }
          >
            <DateTimePicker
              label={t("Starts")}
              placeholder={t("Now")}
              clearable
              clearButtonProps={{ "aria-label": t("Clear start time") }}
              value={values.startsAt}
              onChange={(value) => setTime("startsAt", value as string | null)}
              valueFormat={formatPickerTime}
              error={form.errors.startsAt}
            />
          </Suspense>

          <Suspense
            fallback={
              <Input.Wrapper label={t("Ends")} labelElement="div">
                <Skeleton height={36} radius="sm" />
              </Input.Wrapper>
            }
          >
            <DateTimePicker
              label={t("Ends")}
              placeholder={t("No end")}
              clearable
              clearButtonProps={{ "aria-label": t("Clear end time") }}
              value={values.endsAt}
              onChange={(value) => setTime("endsAt", value as string | null)}
              valueFormat={formatPickerTime}
              error={form.errors.endsAt}
            />
          </Suspense>
        </SimpleGrid>

        {hasText && (
          <Input.Wrapper label={t("Preview")} labelElement="div">
            <Box
              inert
              style={{
                borderRadius: "var(--mantine-radius-sm)",
                overflow: "hidden",
              }}
            >
              <AnnouncementBanner
                announcement={{
                  type: values.type,
                  color: values.color,
                  content: values.content,
                  isDismissible: values.isDismissible,
                }}
              />
            </Box>
          </Input.Wrapper>
        )}

        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={onClose}>
            {t("Cancel")}
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            {replacement
              ? t("Save and replace")
              : announcement
                ? t("Save")
                : t("Create")}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
