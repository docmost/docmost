import {
  type KeyboardEvent,
  lazy,
  Suspense,
  useEffect,
  useId,
  useRef,
} from "react";
import {
  Alert,
  Box,
  Button,
  ColorSwatch,
  Group,
  Input,
  Modal,
  SegmentedControl,
  SimpleGrid,
  Skeleton,
  Stack,
  Switch,
  useMatches,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconAlertCircle, IconCheck } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import {
  ANNOUNCEMENT_COLOR_STYLES,
  ANNOUNCEMENT_COLORS,
  ANNOUNCEMENT_KIND_DEFAULT_COLOR,
  ANNOUNCEMENT_KIND_ICONS,
  ANNOUNCEMENT_KIND_LABELS,
  ANNOUNCEMENT_KINDS,
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
  getAnnouncementErrorMessage,
  getAnnouncementLimitConflict,
  useCreateAnnouncementMutation,
  useUpdateAnnouncementMutation,
} from "@/ee/announcement/queries/announcement-query";
import type {
  AnnouncementAudience,
  AnnouncementKind,
  IAnnouncement,
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
  const kindId = useId();
  const audienceId = useId();
  const startId = useId();
  const endId = useId();
  const alertRef = useRef<HTMLDivElement>(null);
  const kindOrientation = useMatches<"vertical" | "horizontal">(
    { base: "vertical", xs: "horizontal" },
    { getInitialValueInEffect: false },
  );
  const createMutation = useCreateAnnouncementMutation();
  const updateMutation = useUpdateAnnouncementMutation();
  const mutation = announcement ? updateMutation : createMutation;
  const conflict = getAnnouncementLimitConflict(mutation.error);

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

  useEffect(() => {
    if (mutation.error) {
      alertRef.current?.scrollIntoView?.({ block: "nearest" });
    }
  }, [mutation.error]);

  const formatPickerTime = (value: string) =>
    formatPickerValue(value, i18n.language);

  const handleSubmit = async (submitted: AnnouncementFormValues) => {
    const input = toAnnouncementInput(submitted, announcement);
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
    } catch {
      // the alert above the fields shows the error
    }
  };

  return (
    <form onSubmit={form.onSubmit(handleSubmit)}>
      <Stack gap="md">
        {mutation.error && (
          <Alert
            ref={alertRef}
            color="red"
            icon={<IconAlertCircle size={16} />}
            title={
              conflict
                ? t("Up to two announcements can show at the same time.")
                : undefined
            }
          >
            {conflict ? (
              <AnnouncementConflictSummary conflict={conflict} />
            ) : (
              getAnnouncementErrorMessage(mutation.error)
            )}
          </Alert>
        )}

        <Input.Wrapper id={kindId} label={t("Kind")} labelElement="div">
          <SegmentedControl
            fullWidth
            orientation={kindOrientation}
            aria-labelledby={`${kindId}-label`}
            value={values.kind}
            onChange={(value) => {
              const kind = value as AnnouncementKind;
              form.setValues({
                kind,
                color: ANNOUNCEMENT_KIND_DEFAULT_COLOR[kind],
              });
            }}
            data={ANNOUNCEMENT_KINDS.map((kind) => {
              const KindIcon = ANNOUNCEMENT_KIND_ICONS[kind];
              return {
                value: kind,
                label: (
                  <Group gap={6} wrap="nowrap" justify="center">
                    {KindIcon && <KindIcon size={16} aria-hidden />}
                    <span>{t(ANNOUNCEMENT_KIND_LABELS[kind])}</span>
                  </Group>
                ),
              };
            })}
          />
        </Input.Wrapper>

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

        <Input.Wrapper
          id={audienceId}
          label={t("Audience")}
          labelElement="div"
          description={t(
            "Everyone also includes the login page and public pages.",
          )}
          inputWrapperOrder={["label", "input", "description"]}
          descriptionProps={{ mt: 6 }}
        >
          <SegmentedControl
            fullWidth
            aria-labelledby={`${audienceId}-label`}
            aria-describedby={`${audienceId}-description`}
            value={values.audience}
            onChange={(value) =>
              form.setFieldValue("audience", value as AnnouncementAudience)
            }
            data={[
              { value: "members", label: t("Logged-in users") },
              { value: "everyone", label: t("Everyone") },
            ]}
          />
        </Input.Wrapper>

        <Switch
          label={t("Allow people to dismiss it")}
          checked={values.isDismissible}
          onChange={(event) =>
            form.setFieldValue("isDismissible", event.currentTarget.checked)
          }
        />

        <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="md">
          <Input.Wrapper id={startId} label={t("Starts")} labelElement="div">
            <Stack gap="xs">
              <SegmentedControl
                fullWidth
                aria-labelledby={`${startId}-label`}
                value={values.startMode}
                onChange={(value) =>
                  form.setFieldValue(
                    "startMode",
                    value as AnnouncementFormValues["startMode"],
                  )
                }
                data={[
                  { value: "now", label: t("Now") },
                  { value: "date", label: t("At a date") },
                ]}
              />
              {values.startMode === "date" && (
                <Suspense fallback={<Skeleton height={36} radius="sm" />}>
                  <DateTimePicker
                    aria-label={t("Start time")}
                    placeholder={t("Pick date and time")}
                    value={values.startsAt}
                    onChange={(value) =>
                      form.setFieldValue("startsAt", value as string | null)
                    }
                    valueFormat={formatPickerTime}
                    error={form.errors.startsAt}
                  />
                </Suspense>
              )}
            </Stack>
          </Input.Wrapper>

          <Input.Wrapper id={endId} label={t("Ends")} labelElement="div">
            <Stack gap="xs">
              <SegmentedControl
                fullWidth
                aria-labelledby={`${endId}-label`}
                value={values.endMode}
                onChange={(value) =>
                  form.setFieldValue(
                    "endMode",
                    value as AnnouncementFormValues["endMode"],
                  )
                }
                data={[
                  { value: "none", label: t("No end") },
                  { value: "date", label: t("At a date") },
                ]}
              />
              {values.endMode === "date" && (
                <Suspense fallback={<Skeleton height={36} radius="sm" />}>
                  <DateTimePicker
                    aria-label={t("End time")}
                    placeholder={t("Pick date and time")}
                    value={values.endsAt}
                    onChange={(value) =>
                      form.setFieldValue("endsAt", value as string | null)
                    }
                    valueFormat={formatPickerTime}
                    error={form.errors.endsAt}
                  />
                </Suspense>
              )}
            </Stack>
          </Input.Wrapper>
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
                  kind: values.kind,
                  color: values.color,
                  content: values.content,
                  isDismissible: values.isDismissible,
                }}
                onDismiss={() => {}}
              />
            </Box>
          </Input.Wrapper>
        )}

        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={onClose}>
            {t("Cancel")}
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            {announcement ? t("Save") : t("Create")}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
