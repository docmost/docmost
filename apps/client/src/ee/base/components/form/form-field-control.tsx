import {
  Checkbox,
  MultiSelect,
  NumberInput,
  Radio,
  Select,
  Textarea,
  TextInput,
  UnstyledButton,
} from "@mantine/core";
import { DatePickerInput, DateTimePicker } from "@mantine/dates";
import { IconAlertCircle, IconCalendar } from "@tabler/icons-react";
import { startOfDay } from "@docmost/base-formula/client";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  PublicFormChoice,
  PublicFormField,
  PublicFormNumberFormat,
  UserRef,
} from "@/ee/base/types/base.types";
import {
  AUTOFILL_OPT_OUT,
  CHOICE_LIST_LIMIT,
} from "@/ee/base/components/form/form-definition";
import { FormPersonPicker } from "@/ee/base/components/form/form-person-picker";
import { FormRichText } from "@/ee/base/components/form/form-rich-text";
import {
  formDateKind,
  fromDateTimeInput,
  toDateTimeInput,
} from "@/ee/base/components/form/form-date";
import { useViewerDateContext } from "@/ee/base/hooks/use-viewer-date-context";
import {
  MAX_PICKER_DATE,
  MIN_PICKER_DATE,
  readDateCell,
} from "@/ee/base/utils/date-cell";
import {
  formatDateCell,
  formatZoneLabel,
  resolveTimeFormat,
} from "@/ee/base/utils/date-format";
import { timeZoneName } from "@/ee/base/utils/time-zones";
import classes from "@/ee/base/styles/form.module.css";

type FormFieldControlProps = {
  field: PublicFormField;
  value: unknown;
  onChange: (value: unknown) => void;
  controlId: string;
  ariaLabelledBy: string;
  description?: string | null;
  error?: string;
  users?: Record<string, UserRef>;
};

const fieldClassNames = {
  root: classes.fieldRoot,
  wrapper: classes.field,
  input: classes.input,
  description: classes.questionDescription,
  error: classes.errorText,
};

const FIELD_WRAPPER_ORDER: ("description" | "input" | "error")[] = [
  "description",
  "input",
  "error",
];

function currencySymbol(format: PublicFormNumberFormat): string | undefined {
  if (format.currencySymbol) return format.currencySymbol;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: format.currencyCode || "USD",
      currencyDisplay: "narrowSymbol",
    })
      .formatToParts(0)
      .find((part) => part.type === "currency")?.value;
  } catch {
    return undefined;
  }
}

function numberAffixes(format: PublicFormNumberFormat | undefined) {
  if (format?.format === "currency") {
    const symbol = currencySymbol(format);
    return { prefix: symbol ? `${symbol} ` : undefined, suffix: undefined };
  }
  if (format?.format === "percent" || format?.format === "progress") {
    return { prefix: undefined, suffix: "%" };
  }
  return { prefix: undefined, suffix: undefined };
}

const DEFAULT_TIME = "09:00";

function rovingTabIndex(
  choices: PublicFormChoice[],
  choiceId: string,
  selectedId: string | null,
): number {
  const anchor = choices.find((c) => c.id === selectedId) ?? choices[0];
  return anchor?.id === choiceId ? 0 : -1;
}

export function FormFieldControl({
  field,
  value,
  onChange,
  controlId,
  ariaLabelledBy,
  description,
  error,
  users,
}: FormFieldControlProps) {
  const { t, i18n } = useTranslation();
  const { timeZone, today } = useViewerDateContext();
  const invalid = !!error;
  const descriptionId = description ? `${controlId}-description` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const descriptionText = description ? (
    <FormRichText text={description} />
  ) : undefined;
  const errorText = error ? (
    <>
      <IconAlertCircle size={15} stroke={2} />
      {error}
    </>
  ) : undefined;
  const labelling = {
    "aria-labelledby": ariaLabelledBy,
    "aria-describedby":
      [descriptionId, errorId].filter(Boolean).join(" ") || undefined,
  };
  const wrapperProps = {
    id: controlId,
    size: "sm" as const,
    radius: "md" as const,
    description: descriptionText,
    error: errorText,
    inputWrapperOrder: FIELD_WRAPPER_ORDER,
    descriptionProps: { component: "div" },
    errorProps: { role: "alert" },
    classNames: fieldClassNames,
  };
  const inputProps = {
    ...wrapperProps,
    "aria-labelledby": ariaLabelledBy,
    "aria-required": field.required || undefined,
  };
  const textInputProps = { ...inputProps, ...AUTOFILL_OPT_OUT };

  const groupField = (control: ReactNode) => (
    <div className={classes.fieldRoot}>
      {description && (
        <FormRichText
          id={descriptionId}
          text={description}
          className={classes.questionDescription}
        />
      )}
      {control}
      {error && (
        <div id={errorId} className={classes.errorText} role="alert">
          {errorText}
        </div>
      )}
    </div>
  );

  switch (field.type) {
    case "longText":
      return (
        <Textarea
          {...textInputProps}
          autosize
          minRows={3}
          maxRows={12}
          maxLength={25000}
          placeholder={t("Your answer")}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.currentTarget.value)}
        />
      );

    case "number": {
      const format = field.numberFormat;
      const { prefix, suffix } = numberAffixes(format);
      return (
        <NumberInput
          {...textInputProps}
          hideControls
          prefix={prefix}
          suffix={suffix}
          decimalScale={format?.precision}
          placeholder={t("Your answer")}
          value={
            typeof value === "number" || typeof value === "string" ? value : ""
          }
          onChange={(next) => onChange(next)}
        />
      );
    }

    case "select": {
      const choices = field.choices ?? [];
      const selected = typeof value === "string" ? value : null;
      if (choices.length > CHOICE_LIST_LIMIT) {
        return (
          <Select
            {...textInputProps}
            searchable
            selectFirstOptionOnChange
            clearable={!field.required}
            placeholder={t("Select an option")}
            nothingFoundMessage={t("No options found")}
            comboboxProps={{ shadow: "md", radius: "md" }}
            data={choices.map((c) => ({ value: c.id, label: c.name }))}
            value={selected}
            onChange={(next) => onChange(next)}
          />
        );
      }
      return groupField(
        <div className={classes.choiceGroup}>
          <div
            id={controlId}
            role="radiogroup"
            className={classes.optionList}
            aria-required={field.required || undefined}
            aria-invalid={invalid || undefined}
            {...labelling}
          >
            {choices.map((choice) => (
              <Radio.Card
                key={choice.id}
                name={controlId}
                value={choice.id}
                checked={selected === choice.id}
                withBorder={false}
                className={classes.option}
                mod={{ invalid }}
                tabIndex={rovingTabIndex(choices, choice.id, selected)}
                onClick={() => onChange(choice.id)}
              >
                <Radio.Indicator size="sm" />
                <span className={classes.optionLabel}>{choice.name}</span>
              </Radio.Card>
            ))}
          </div>
          {selected && !field.required && (
            <UnstyledButton
              className={classes.clearChoice}
              onClick={() => onChange(null)}
            >
              {t("Clear selection")}
            </UnstyledButton>
          )}
        </div>,
      );
    }

    case "multiSelect": {
      const choices = field.choices ?? [];
      const selected = Array.isArray(value) ? (value as string[]) : [];
      if (choices.length > CHOICE_LIST_LIMIT) {
        return (
          <MultiSelect
            {...textInputProps}
            searchable
            selectFirstOptionOnChange
            clearable
            placeholder={selected.length ? undefined : t("Select options")}
            nothingFoundMessage={t("No options found")}
            comboboxProps={{ shadow: "md", radius: "md" }}
            data={choices.map((c) => ({ value: c.id, label: c.name }))}
            value={selected}
            onChange={(next) => onChange(next)}
          />
        );
      }
      return groupField(
        <div
          id={controlId}
          role="group"
          className={classes.optionList}
          aria-invalid={invalid || undefined}
          {...labelling}
        >
          {choices.map((choice) => {
            const checked = selected.includes(choice.id);
            return (
              <Checkbox.Card
                key={choice.id}
                value={choice.id}
                checked={checked}
                withBorder={false}
                className={classes.option}
                mod={{ invalid }}
                onClick={() =>
                  onChange(
                    checked
                      ? selected.filter((id) => id !== choice.id)
                      : [...selected, choice.id],
                  )
                }
              >
                <Checkbox.Indicator size="sm" radius="sm" />
                <span className={classes.optionLabel}>{choice.name}</span>
              </Checkbox.Card>
            );
          })}
        </div>,
      );
    }

    case "date": {
      const cell = readDateCell(value, formDateKind(field));
      const displayOptions = {
        dateFormat: field.dateFormat === "relative" ? undefined : field.dateFormat,
        timeFormat: field.timeFormat,
        locale: i18n.language,
        timeZone,
        today,
      };
      const dateInputProps = {
        ...inputProps,
        clearable: true,
        minDate: MIN_PICKER_DATE,
        maxDate: MAX_PICKER_DATE,
        defaultDate: today,
        leftSection: <IconCalendar size={16} stroke={1.75} />,
        leftSectionPointerEvents: "none" as const,
        popoverProps: { shadow: "md", radius: "md" },
      };
      if (formDateKind(field) === "datetime") {
        const zoneLabel = formatZoneLabel(
          cell?.start ?? startOfDay(today, timeZone),
          timeZone,
          i18n.language,
        );
        const zone =
          zoneLabel === timeZone
            ? timeZoneName(timeZone)
            : `${timeZoneName(timeZone)} (${zoneLabel})`;
        const zoneCaption = t("Time zone: {{zone}}", { zone });
        return (
          <DateTimePicker
            {...dateInputProps}
            description={
              descriptionText ? (
                <>
                  {descriptionText}
                  <div>{zoneCaption}</div>
                </>
              ) : (
                zoneCaption
              )
            }
            placeholder={t("Pick a date and time")}
            defaultTimeValue={cell ? undefined : DEFAULT_TIME}
            valueFormat={() => formatDateCell(cell, displayOptions)}
            timePickerProps={{
              format: resolveTimeFormat(field.timeFormat, i18n.language),
              hoursInputLabel: t("Hours"),
              minutesInputLabel: t("Minutes"),
              amPmInputLabel: t("AM/PM"),
              amPmLabels: { am: t("AM"), pm: t("PM") },
            }}
            submitButtonProps={{ "aria-label": t("Confirm") }}
            value={toDateTimeInput(cell, timeZone)}
            onChange={(next) => onChange(fromDateTimeInput(next, cell, timeZone))}
          />
        );
      }
      return (
        <DatePickerInput
          {...dateInputProps}
          placeholder={t("Pick a date")}
          valueFormatter={() => formatDateCell(cell, displayOptions)}
          value={cell?.start ?? null}
          onChange={(next) => onChange(next ? { start: next.slice(0, 10) } : null)}
        />
      );
    }

    case "checkbox":
      return groupField(
        <div className={classes.optionList}>
          <Checkbox.Card
            id={controlId}
            checked={value === true}
            withBorder={false}
            className={classes.option}
            mod={{ invalid }}
            aria-required={field.required || undefined}
            aria-invalid={invalid || undefined}
            {...labelling}
            onClick={() => onChange(value !== true)}
          >
            <Checkbox.Indicator size="sm" radius="sm" />
            <span className={classes.optionLabel}>{t("Yes")}</span>
          </Checkbox.Card>
        </div>,
      );

    case "person":
      return (
        <FormPersonPicker
          value={value}
          allowMultiple={field.allowMultiple === true}
          onChange={onChange}
          knownUsers={users}
          wrapperProps={wrapperProps}
          ariaLabelledBy={ariaLabelledBy}
          required={field.required}
        />
      );

    case "url":
      return (
        <TextInput
          {...textInputProps}
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={2048}
          placeholder="https://"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.currentTarget.value)}
        />
      );

    case "email":
      return (
        <TextInput
          {...textInputProps}
          inputMode="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={320}
          placeholder="name@example.com"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.currentTarget.value)}
        />
      );

    default:
      return (
        <TextInput
          {...textInputProps}
          maxLength={1000}
          placeholder={t("Your answer")}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.currentTarget.value)}
        />
      );
  }
}
