import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Stack,
  NumberInput,
  Select,
  Switch,
  Text,
  Button,
  Group,
  Divider,
  TextInput,
  Textarea,
} from "@mantine/core";
import {
  IBaseProperty,
  SelectTypeOptions,
  NumberTypeOptions,
  DateTypeOptions,
  PersonTypeOptions,
  Choice,
} from "@/ee/base/types/base.types";
import { ChoiceEditor } from "./choice-editor";
import { FilterPersonInput } from "@/ee/base/components/views/filter-person-input";
import {
  CURRENCIES,
  DEFAULT_CURRENCY_CODE,
} from "@/ee/base/constants/currencies";
import {
  DATE_FORMAT_LABELS,
  DATE_FORMATS,
  DateFormat,
  dateTypeOptionsOf,
  formatDateCell,
  resolveTimeFormat,
  TIME_FORMAT_LABELS,
} from "@/ee/base/utils/date-format";
import { useViewerDateContext } from "@/ee/base/hooks/use-viewer-date-context";
import { useBaseQuery } from "@/ee/base/queries/base-query";
import { timeZoneName } from "@/ee/base/utils/time-zones";
import { IconCheck } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

type PropertyOptionsProps = {
  property: IBaseProperty;
  onUpdate: (typeOptions: Record<string, unknown>) => void;
  onClose: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  hideButtons?: boolean;
  // Portal target for nested Select dropdowns; must be inside the host popover, outside ScrollArea.
  dropdownPortalTarget?: HTMLElement | null;
};

export function PropertyOptions({
  property,
  onUpdate,
  onClose,
  onDirtyChange,
  hideButtons,
  dropdownPortalTarget,
}: PropertyOptionsProps) {
  const { t } = useTranslation();

  switch (property.type) {
    case "select":
    case "multiSelect":
      return (
        <SelectOptions
          property={property}
          onUpdate={onUpdate}
          onClose={onClose}
          onDirtyChange={onDirtyChange}
          hideButtons={hideButtons}
          dropdownPortalTarget={dropdownPortalTarget}
        />
      );
    case "status":
      return (
        <StatusOptions
          property={property}
          onUpdate={onUpdate}
          onClose={onClose}
          onDirtyChange={onDirtyChange}
          hideButtons={hideButtons}
          dropdownPortalTarget={dropdownPortalTarget}
        />
      );
    case "number":
      return (
        <NumberOptions
          property={property}
          onUpdate={onUpdate}
          onClose={onClose}
          onDirtyChange={onDirtyChange}
          hideButtons={hideButtons}
          dropdownPortalTarget={dropdownPortalTarget}
        />
      );
    case "date":
      return (
        <DateOptions
          property={property}
          onUpdate={onUpdate}
          onClose={onClose}
          onDirtyChange={onDirtyChange}
          hideButtons={hideButtons}
          dropdownPortalTarget={dropdownPortalTarget}
        />
      );
    case "person":
      return (
        <PersonOptions
          property={property}
          onUpdate={onUpdate}
          onClose={onClose}
          onDirtyChange={onDirtyChange}
          hideButtons={hideButtons}
          dropdownPortalTarget={dropdownPortalTarget}
        />
      );
    case "text":
    case "longText":
    case "url":
    case "email":
      return (
        <TextDefaultOptions
          property={property}
          onUpdate={onUpdate}
          onClose={onClose}
          onDirtyChange={onDirtyChange}
          hideButtons={hideButtons}
        />
      );
    case "checkbox":
      return (
        <CheckboxOptions
          property={property}
          onUpdate={onUpdate}
          onClose={onClose}
          onDirtyChange={onDirtyChange}
          hideButtons={hideButtons}
        />
      );
    default:
      return (
        <Text size="xs" c="dimmed">
          {t("No options for this property type")}
        </Text>
      );
  }
}

type OptionEditorProps = {
  property: IBaseProperty;
  onUpdate: (typeOptions: Record<string, unknown>) => void;
  onClose: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  hideButtons?: boolean;
  dropdownPortalTarget?: HTMLElement | null;
};

const EMPTY_OPTIONS: Record<string, unknown> = {};

function optionsEqual(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    const av = a[key];
    const bv = b[key];
    if (Array.isArray(av) && Array.isArray(bv)) {
      if (av.length !== bv.length || av.some((v, i) => v !== bv[i])) {
        return false;
      }
    } else if (av !== bv) {
      return false;
    }
  }
  return true;
}

// Draft hook for non-choice option editors: live in create flow, staged in edit menu.
function useEditableTypeOptions(
  initialRaw: Record<string, unknown> | undefined,
  {
    onUpdate,
    onClose,
    onDirtyChange,
    hideButtons,
  }: {
    onUpdate: (opts: Record<string, unknown>) => void;
    onClose: () => void;
    onDirtyChange?: (dirty: boolean) => void;
    hideButtons?: boolean;
  },
) {
  const initial = initialRaw ?? EMPTY_OPTIONS;
  const [draft, setDraft] = useState<Record<string, unknown>>(initial);

  useEffect(() => {
    if (!hideButtons) setDraft(initial);
  }, [initial, hideButtons]);

  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;
  useEffect(() => {
    if (hideButtons) onUpdateRef.current(draft);
  }, [hideButtons, draft]);

  const isDirty = useMemo(() => !optionsEqual(draft, initial), [draft, initial]);
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const update = useCallback(
    (patch: Record<string, unknown>) =>
      setDraft((prev) => ({ ...prev, ...patch })),
    [],
  );
  const save = useCallback(() => {
    onUpdate(draft);
    onClose();
  }, [draft, onUpdate, onClose]);
  const cancel = useCallback(() => {
    setDraft(initial);
    onDirtyChange?.(false);
    onClose();
  }, [initial, onClose, onDirtyChange]);

  return { draft, update, isDirty, save, cancel };
}

function OptionsFooter({
  isDirty,
  onCancel,
  onSave,
}: {
  isDirty: boolean;
  onCancel: () => void;
  onSave: () => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <Divider />
      <Group justify="flex-end" gap="xs">
        <Button variant="default" size="xs" onClick={onCancel}>
          {t("Cancel")}
        </Button>
        <Button size="xs" onClick={onSave} disabled={!isDirty}>
          {t("Save")}
        </Button>
      </Group>
    </>
  );
}

function SelectOptions({
  property,
  onUpdate,
  onClose,
  onDirtyChange,
  hideButtons,
  dropdownPortalTarget,
}: OptionEditorProps) {
  const options = property.typeOptions as SelectTypeOptions | undefined;
  const choices = useMemo(() => options?.choices ?? [], [options?.choices]);

  const handleSave = useCallback(
    (newChoices: Choice[], defaultValue: string | string[] | null) => {
      onUpdate({
        ...property.typeOptions,
        choices: newChoices,
        choiceOrder: newChoices.map((c) => c.id),
        defaultValue,
      });
    },
    [property.typeOptions, onUpdate],
  );

  return (
    <ChoiceEditor
      initialChoices={choices}
      onSave={handleSave}
      onClose={onClose}
      onDirtyChange={onDirtyChange}
      showCategories={false}
      hideButtons={hideButtons}
      initialDefaultValue={options?.defaultValue ?? null}
      multiDefault={property.type === "multiSelect"}
      dropdownPortalTarget={dropdownPortalTarget}
    />
  );
}

function StatusOptions({
  property,
  onUpdate,
  onClose,
  onDirtyChange,
  hideButtons,
  dropdownPortalTarget,
}: OptionEditorProps) {
  const options = property.typeOptions as SelectTypeOptions | undefined;
  const choices = useMemo(() => options?.choices ?? [], [options?.choices]);

  const handleSave = useCallback(
    (newChoices: Choice[], defaultValue: string | string[] | null) => {
      onUpdate({
        ...property.typeOptions,
        choices: newChoices,
        choiceOrder: newChoices.map((c) => c.id),
        defaultValue,
      });
    },
    [property.typeOptions, onUpdate],
  );

  return (
    <ChoiceEditor
      initialChoices={choices}
      onSave={handleSave}
      onClose={onClose}
      onDirtyChange={onDirtyChange}
      showCategories
      hideButtons={hideButtons}
      initialDefaultValue={options?.defaultValue ?? null}
      dropdownPortalTarget={dropdownPortalTarget}
    />
  );
}

function NumberOptions({
  property,
  onUpdate,
  onClose,
  onDirtyChange,
  hideButtons,
  dropdownPortalTarget,
}: OptionEditorProps) {
  const { t } = useTranslation();
  const { draft, update, isDirty, save, cancel } = useEditableTypeOptions(
    property.typeOptions as Record<string, unknown> | undefined,
    { onUpdate, onClose, onDirtyChange, hideButtons },
  );
  const options = draft as NumberTypeOptions;

  return (
    <Stack gap="xs">
      <Select
        size="xs"
        label={t("Format")}
        allowDeselect={false}
        checkIconPosition="right"
        comboboxProps={{ portalProps: { target: dropdownPortalTarget ?? undefined } }}
        data={[
          { value: "plain", label: t("Number") },
          { value: "currency", label: t("Currency") },
          { value: "percent", label: t("Percent") },
          { value: "progress", label: t("Progress") },
        ]}
        value={options.format ?? "plain"}
        onChange={(val) => update({ format: val ?? "plain" })}
      />
      {options.format === "currency" && (
        <Select
          size="xs"
          label={t("Currency")}
          allowDeselect={false}
          checkIconPosition="right"
          comboboxProps={{ portalProps: { target: dropdownPortalTarget ?? undefined } }}
          data={CURRENCIES.map((c) => ({
            value: c.code,
            label: `${c.name} (${c.code})`,
          }))}
          value={options.currencyCode ?? DEFAULT_CURRENCY_CODE}
          onChange={(val) =>
            update({ currencyCode: val ?? DEFAULT_CURRENCY_CODE })
          }
        />
      )}
      <Select
        size="xs"
        label={t("Thousands and decimal separators")}
        allowDeselect={false}
        checkIconPosition="right"
        comboboxProps={{ portalProps: { target: dropdownPortalTarget ?? undefined } }}
        data={[
          { value: "none", label: t("None") },
          { value: "local", label: t("Local") },
          { value: "comma_period", label: t("Comma, period") },
          { value: "period_comma", label: t("Period, comma") },
          { value: "space_comma", label: t("Space, comma") },
          { value: "space_period", label: t("Space, period") },
        ]}
        value={options.separators ?? "none"}
        onChange={(val) => update({ separators: val ?? "none" })}
      />
      <Select
        size="xs"
        label={t("Decimal places")}
        allowDeselect={false}
        checkIconPosition="right"
        comboboxProps={{ portalProps: { target: dropdownPortalTarget ?? undefined } }}
        data={[
          { value: "default", label: t("Default") },
          ...Array.from({ length: 9 }, (_, i) => ({
            value: String(i),
            label: String(i),
          })),
        ]}
        value={options.precision == null ? "default" : String(options.precision)}
        onChange={(val) =>
          update({ precision: val == null || val === "default" ? undefined : Number(val) })
        }
      />
      <NumberInput
        size="xs"
        label={t("Default value")}
        placeholder={t("None")}
        value={typeof options.defaultValue === "number" ? options.defaultValue : ""}
        onChange={(val) =>
          update({ defaultValue: typeof val === "number" ? val : undefined })
        }
      />
      {!hideButtons && (
        <OptionsFooter isDirty={isDirty} onCancel={cancel} onSave={save} />
      )}
    </Stack>
  );
}

function DateOptions({
  property,
  onUpdate,
  onClose,
  onDirtyChange,
  hideButtons,
  dropdownPortalTarget,
}: OptionEditorProps) {
  const { t, i18n } = useTranslation();
  const { timeZone, today } = useViewerDateContext();
  const { data: base } = useBaseQuery(property.pageId);
  const storedOptions = useMemo(
    () => dateTypeOptionsOf(property.typeOptions),
    [property.typeOptions],
  );
  const { draft, update, isDirty, save, cancel } = useEditableTypeOptions(
    storedOptions,
    { onUpdate, onClose, onDirtyChange, hideButtons },
  );
  const [confirmingTimeRemoval, setConfirmingTimeRemoval] = useState(false);
  const options = draft as DateTypeOptions;
  const includeTime = options.includeTime === true;
  const locale = i18n.language;
  const dateFormat: DateFormat = DATE_FORMATS.includes(options.dateFormat)
    ? options.dateFormat
    : "medium";
  const timeFormat = resolveTimeFormat(options.timeFormat, locale);
  const removesTime = storedOptions.includeTime === true && !includeTime;
  useEffect(() => {
    if (!removesTime) setConfirmingTimeRemoval(false);
  }, [removesTime]);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const includeTimeRef = useRef<HTMLInputElement>(null);
  const focusIncludeTimeRef = useRef(false);
  const confirmationTitleId = useId();
  useEffect(() => {
    if (confirmingTimeRemoval) cancelRef.current?.focus();
    else if (focusIncludeTimeRef.current) {
      focusIncludeTimeRef.current = false;
      includeTimeRef.current?.focus();
    }
  }, [confirmingTimeRemoval]);
  const handleSave = () => {
    if (removesTime) {
      setConfirmingTimeRemoval(true);
    } else {
      save();
    }
  };
  const comboboxProps = {
    portalProps: { target: dropdownPortalTarget ?? undefined },
  };

  if (confirmingTimeRemoval) {
    return (
      <Stack gap="xs" role="group" aria-labelledby={confirmationTitleId}>
        <Text id={confirmationTitleId} size="sm" fw={600}>
          {t("Remove time from {{name}}?", { name: property.name })}
        </Text>
        <Text size="xs" c="dimmed">
          {t("Cells keep their day in {{zone}} and lose the time.", {
            zone: timeZoneName(base?.baseTimeZone ?? "UTC"),
          })}
        </Text>
        <Group gap="xs" justify="flex-end">
          <Button
            ref={cancelRef}
            variant="default"
            size="xs"
            onClick={() => {
              focusIncludeTimeRef.current = true;
              setConfirmingTimeRemoval(false);
            }}
          >
            {t("Cancel")}
          </Button>
          <Button color="red" size="xs" onClick={save}>
            {t("Remove time")}
          </Button>
        </Group>
      </Stack>
    );
  }

  return (
    <Stack gap="xs">
      <Select
        size="xs"
        label={t("Date format")}
        allowDeselect={false}
        comboboxProps={comboboxProps}
        data={DATE_FORMATS.map((format) => ({
          value: format,
          label: t(DATE_FORMAT_LABELS[format]),
        }))}
        value={dateFormat}
        onChange={(val) => {
          if (val && val !== dateFormat) update({ dateFormat: val });
        }}
        renderOption={({ option, checked }) => (
          <Group
            gap="xs"
            wrap="nowrap"
            justify="space-between"
            style={{ flex: 1 }}
          >
            <Text size="xs" truncate>
              {option.label}
            </Text>
            <Group gap={6} wrap="nowrap">
              <Text size="xs" c="dimmed" style={{ whiteSpace: "nowrap" }}>
                {formatDateCell(
                  { start: today },
                  {
                    dateFormat: option.value as DateFormat,
                    locale,
                    timeZone,
                    today,
                  },
                )}
              </Text>
              <IconCheck
                size={14}
                color="var(--mantine-color-dimmed)"
                style={{ visibility: checked ? "visible" : "hidden" }}
              />
            </Group>
          </Group>
        )}
      />
      <Switch
        ref={includeTimeRef}
        size="xs"
        label={t("Include time")}
        aria-label={t("Include time")}
        description={t("Applies to every date in this property")}
        checked={includeTime}
        onChange={(e) => update({ includeTime: e.currentTarget.checked })}
      />
      {includeTime && (
        <Select
          size="xs"
          label={t("Time format")}
          allowDeselect={false}
          checkIconPosition="right"
          comboboxProps={comboboxProps}
          data={(["12h", "24h"] as const).map((format) => ({
            value: format,
            label: t(TIME_FORMAT_LABELS[format]),
          }))}
          value={timeFormat}
          onChange={(val) => {
            if (val && val !== timeFormat) update({ timeFormat: val });
          }}
        />
      )}
      {!hideButtons && (
        <OptionsFooter isDirty={isDirty} onCancel={cancel} onSave={handleSave} />
      )}
    </Stack>
  );
}

function PersonOptions({
  property,
  onUpdate,
  onClose,
  onDirtyChange,
  hideButtons,
  dropdownPortalTarget,
}: OptionEditorProps) {
  const { t } = useTranslation();
  const { draft, update, isDirty, save, cancel } = useEditableTypeOptions(
    property.typeOptions as Record<string, unknown> | undefined,
    { onUpdate, onClose, onDirtyChange, hideButtons },
  );
  const options = draft as PersonTypeOptions;
  const allowMultiple = options.allowMultiple === true;

  const handleAllowMultipleChange = (toMulti: boolean) => {
    const dv = options.defaultValue;
    const ids = Array.isArray(dv) ? dv : dv ? [dv] : [];
    update({
      allowMultiple: toMulti,
      defaultValue: toMulti ? (ids.length ? ids : undefined) : ids[0],
    });
  };

  return (
    <Stack gap="xs">
      <Switch
        size="xs"
        label={t("Allow multiple people")}
        checked={allowMultiple}
        onChange={(e) => handleAllowMultipleChange(e.currentTarget.checked)}
      />
      <FilterPersonInput
        pageId={property.pageId}
        multiple={allowMultiple}
        value={options.defaultValue ?? null}
        onChange={(value) =>
          update({ defaultValue: value as string | string[] | undefined })
        }
        placeholder={t("None")}
        label={t("Default value")}
        w="100%"
        portalTarget={dropdownPortalTarget}
      />
      {!hideButtons && (
        <OptionsFooter isDirty={isDirty} onCancel={cancel} onSave={save} />
      )}
    </Stack>
  );
}

const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function TextDefaultOptions({
  property,
  onUpdate,
  onClose,
  onDirtyChange,
  hideButtons,
}: OptionEditorProps) {
  const { t } = useTranslation();
  const { draft, update, isDirty, save, cancel } = useEditableTypeOptions(
    property.typeOptions as Record<string, unknown> | undefined,
    { onUpdate, onClose, onDirtyChange, hideButtons },
  );
  const defaultValue =
    typeof draft.defaultValue === "string" ? draft.defaultValue : "";
  const defaultValueError =
    defaultValue && property.type === "url" && !URL.canParse(defaultValue)
      ? t("Please enter a valid url")
      : defaultValue &&
          property.type === "email" &&
          !EMAIL_FORMAT.test(defaultValue)
        ? t("Please enter a valid email")
        : null;

  return (
    <Stack gap="xs">
      {property.type === "longText" ? (
        <Textarea
          size="xs"
          label={t("Default value")}
          placeholder={t("None")}
          autosize
          minRows={2}
          maxRows={6}
          value={defaultValue}
          onChange={(e) =>
            update({
              defaultValue: e.currentTarget.value.trim()
                ? e.currentTarget.value
                : undefined,
            })
          }
        />
      ) : (
        <TextInput
          size="xs"
          label={t("Default value")}
          placeholder={
            property.type === "url"
              ? "https://example.com"
              : property.type === "email"
                ? "name@example.com"
                : t("None")
          }
          value={defaultValue}
          error={defaultValueError}
          onChange={(e) =>
            update({
              defaultValue: e.currentTarget.value.trim()
                ? e.currentTarget.value
                : undefined,
            })
          }
        />
      )}
      {!hideButtons && (
        <OptionsFooter
          isDirty={isDirty && !defaultValueError}
          onCancel={cancel}
          onSave={save}
        />
      )}
    </Stack>
  );
}

function CheckboxOptions({
  property,
  onUpdate,
  onClose,
  onDirtyChange,
  hideButtons,
}: OptionEditorProps) {
  const { t } = useTranslation();
  const { draft, update, isDirty, save, cancel } = useEditableTypeOptions(
    property.typeOptions as Record<string, unknown> | undefined,
    { onUpdate, onClose, onDirtyChange, hideButtons },
  );

  return (
    <Stack gap="xs">
      <Switch
        size="xs"
        label={t("Checked by default")}
        checked={draft.defaultValue === true}
        onChange={(e) =>
          update({ defaultValue: e.currentTarget.checked ? true : undefined })
        }
      />
      {!hideButtons && (
        <OptionsFooter isDirty={isDirty} onCancel={cancel} onSave={save} />
      )}
    </Stack>
  );
}
