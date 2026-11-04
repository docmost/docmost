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
  List,
  Modal,
  SegmentedControl,
  SimpleGrid,
  Skeleton,
  Stack,
  Switch,
  Text,
  useMatches,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconAlertCircle, IconCheck } from "@tabler/icons-react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import {
  ANNOUNCEMENT_COLOR_STYLES,
  ANNOUNCEMENT_COLORS,
  ANNOUNCEMENT_KIND_DEFAULT_COLOR,
  ANNOUNCEMENT_KIND_ICONS,
  ANNOUNCEMENT_KIND_LABELS,
  ANNOUNCEMENT_KINDS,
  ANNOUNCEMENT_MAX_TEXT_LENGTH,
} from "@/ee/announcement/announcement.constants";
import {
  fromPickerValue,
  getAnnouncementPlainText,
  toPickerValue,
} from "@/ee/announcement/announcement.utils";
import { AnnouncementBanner } from "@/ee/announcement/components/announcement-banner";
import { AnnouncementMessageEditor } from "@/ee/announcement/components/announcement-message-editor";
import {
  getAnnouncementErrorMessage,
  getAnnouncementLimitConflict,
  useCreateAnnouncementMutation,
  useUpdateAnnouncementMutation,
} from "@/ee/announcement/queries/announcement-query";
import type {
  AnnouncementAudience,
  AnnouncementColor,
  AnnouncementKind,
  IAnnouncement,
  IAnnouncementContent,
  IAnnouncementInput,
} from "@/ee/announcement/types/announcement.types";

const DateTimePicker = lazy(() =>
  import("@mantine/dates").then((module) => ({
    default: module.DateTimePicker,
  })),
);

const DATE_TIME_FORMAT: Intl.DateTimeFormatOptions = {
  dateStyle: "medium",
  timeStyle: "short",
};

const RADIO_KEY_STEPS: Record<string, number> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
};

type AnnouncementFormValues = {
  kind: AnnouncementKind;
  color: AnnouncementColor;
  content: IAnnouncementContent | null;
  audience: AnnouncementAudience;
  isDismissible: boolean;
  startMode: "now" | "date";
  startsAt: string | null;
  endMode: "none" | "date";
  endsAt: string | null;
};

type AnnouncementFormModalProps = {
  opened: boolean;
  onClose: () => void;
  announcement: IAnnouncement | null;
};

function getInitialValues(
  announcement: IAnnouncement | null,
): AnnouncementFormValues {
  if (!announcement) {
    return {
      kind: "info",
      color: ANNOUNCEMENT_KIND_DEFAULT_COLOR.info,
      content: null,
      audience: "members",
      isDismissible: false,
      startMode: "now",
      startsAt: null,
      endMode: "none",
      endsAt: null,
    };
  }
  return {
    kind: announcement.kind,
    color: announcement.color,
    content: announcement.content,
    audience: announcement.audience,
    isDismissible: announcement.isDismissible,
    startMode: "date",
    startsAt: toPickerValue(announcement.startsAt),
    endMode: announcement.endsAt ? "date" : "none",
    endsAt: announcement.endsAt ? toPickerValue(announcement.endsAt) : null,
  };
}

function getPickerTime(value: string | null): number | null {
  if (!value) {
    return null;
  }
  try {
    return Date.parse(fromPickerValue(value));
  } catch {
    return null;
  }
}

// The picker drops milliseconds, so an untouched time is sent as stored
function toInputTime(value: string, stored: string | null): string {
  return stored && toPickerValue(stored) === value
    ? stored
    : fromPickerValue(value);
}

function validateAnnouncementForm(
  values: AnnouncementFormValues,
  storedEndsAt: string | null,
  t: TFunction,
): Partial<Record<keyof AnnouncementFormValues, string>> {
  const errors: Partial<Record<keyof AnnouncementFormValues, string>> = {};
  const text = values.content ? getAnnouncementPlainText(values.content) : "";
  if (!text.trim()) {
    errors.content = t("Announcement message is required");
  } else if (text.length > ANNOUNCEMENT_MAX_TEXT_LENGTH) {
    errors.content = t("Announcement message is too long");
  }

  const now = Date.now();
  const startTime =
    values.startMode === "now" ? now : getPickerTime(values.startsAt);
  if (startTime === null) {
    errors.startsAt = t("Start time is required");
  }

  if (values.endMode === "date") {
    const endTime = getPickerTime(values.endsAt);
    // Like the server, an end left as stored may already have passed
    const endChanged =
      !storedEndsAt || values.endsAt !== toPickerValue(storedEndsAt);
    if (endTime === null) {
      errors.endsAt = t("End time is required");
    } else if (endChanged && endTime <= now) {
      errors.endsAt = t("End time must be in the future");
    } else if (startTime !== null && endTime <= startTime) {
      errors.endsAt = t("End time must be after the start time");
    }
  }
  return errors;
}

function toAnnouncementInput(
  values: AnnouncementFormValues,
  announcement: IAnnouncement | null,
): IAnnouncementInput {
  return {
    kind: values.kind,
    color: values.color,
    content: values.content,
    isDismissible: values.isDismissible,
    audience: values.audience,
    startsAt:
      values.startMode === "now"
        ? null
        : toInputTime(values.startsAt, announcement?.startsAt ?? null),
    endsAt:
      values.endMode === "none"
        ? null
        : toInputTime(values.endsAt, announcement?.endsAt ?? null),
  };
}

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

  const formatTime = (time: string | number) =>
    new Date(time).toLocaleString(i18n.language, DATE_TIME_FORMAT);
  const formatPickerValue = (value: string) => {
    const time = getPickerTime(value);
    return time === null ? value : formatTime(time);
  };

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
              <>
                <Text size="sm">
                  {conflict.to
                    ? t("These already show between {{from}} and {{to}}:", {
                        from: formatTime(conflict.from),
                        to: formatTime(conflict.to),
                      })
                    : t("These already show from {{from}} with no end:", {
                        from: formatTime(conflict.from),
                      })}
                </Text>
                <List size="sm" mt={4}>
                  {conflict.announcements.map((clash) => (
                    <List.Item key={clash.id}>{clash.preview}</List.Item>
                  ))}
                </List>
              </>
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
          description={
            values.audience === "everyone"
              ? t("Also shows on the login page and public pages")
              : undefined
          }
          inputWrapperOrder={["label", "input", "description"]}
          descriptionProps={{ mt: 6 }}
        >
          <SegmentedControl
            fullWidth
            aria-labelledby={`${audienceId}-label`}
            aria-describedby={
              values.audience === "everyone"
                ? `${audienceId}-description`
                : undefined
            }
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
                    valueFormat={formatPickerValue}
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
                    valueFormat={formatPickerValue}
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
