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
import { IconCalendar } from "@tabler/icons-react";
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
import {
  isDateOnly,
  localPartsToInstant,
  MAX_PICKER_DATE,
  MIN_PICKER_DATE,
  parseDateValue,
  partToLocalYmd,
  resolveTimeFormat,
} from "@/ee/base/utils/date-value";
import classes from "@/ee/base/styles/form.module.css";

type FormFieldControlProps = {
  field: PublicFormField;
  value: unknown;
  onChange: (value: unknown) => void;
  controlId: string;
  ariaLabelledBy: string;
  ariaDescribedBy?: string;
  invalid?: boolean;
  users?: Record<string, UserRef>;
};

const fieldClassNames = { wrapper: classes.field, input: classes.input };

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
const LOCAL_DATE_TIME = /^(\d{4}-\d{2}-\d{2}) (\d{2}):(\d{2})/;

function toLocalDateTime(part: string | null): string | null {
  if (!part) return null;
  const time = isDateOnly(part)
    ? "00:00"
    : new Date(part).toTimeString().slice(0, 5);
  return `${partToLocalYmd(part)} ${time}:00`;
}

function fromLocalDateTime(local: string | null): { start: string } | null {
  const match = local ? LOCAL_DATE_TIME.exec(local) : null;
  if (!match) return null;
  return {
    start: localPartsToInstant(match[1], Number(match[2]), Number(match[3])),
  };
}

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
  ariaDescribedBy,
  invalid,
  users,
}: FormFieldControlProps) {
  const { t, i18n } = useTranslation();
  const labelling = {
    "aria-labelledby": ariaLabelledBy,
    "aria-describedby": ariaDescribedBy,
  };
  const inputProps = {
    ...labelling,
    id: controlId,
    size: "sm" as const,
    radius: "md" as const,
    error: invalid,
    classNames: fieldClassNames,
    "aria-required": field.required || undefined,
    "aria-invalid": invalid || undefined,
  };
  const textInputProps = { ...inputProps, ...AUTOFILL_OPT_OUT };

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
      return (
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
        </div>
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
      return (
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
        </div>
      );
    }

    case "date": {
      const start = parseDateValue(value)?.start ?? null;
      const dateInputProps = {
        ...inputProps,
        clearable: true,
        minDate: MIN_PICKER_DATE,
        maxDate: MAX_PICKER_DATE,
        leftSection: <IconCalendar size={16} stroke={1.75} />,
        leftSectionPointerEvents: "none" as const,
        popoverProps: { shadow: "md", radius: "md" },
      };
      if (field.includeTime) {
        const timeFormat = resolveTimeFormat(undefined, i18n.language);
        return (
          <DateTimePicker
            {...dateInputProps}
            placeholder={t("Pick a date and time")}
            defaultTimeValue={start ? undefined : DEFAULT_TIME}
            valueFormat={
              timeFormat === "12h" ? "MMM D, YYYY h:mm A" : "MMM D, YYYY HH:mm"
            }
            timePickerProps={{
              format: timeFormat,
              hoursInputLabel: t("Hours"),
              minutesInputLabel: t("Minutes"),
              amPmInputLabel: t("AM/PM"),
              amPmLabels: { am: t("AM"), pm: t("PM") },
            }}
            submitButtonProps={{ "aria-label": t("Confirm") }}
            value={toLocalDateTime(start)}
            onChange={(next) => onChange(fromLocalDateTime(next))}
          />
        );
      }
      return (
        <DatePickerInput
          {...dateInputProps}
          placeholder={t("Pick a date")}
          valueFormat="MMM D, YYYY"
          value={start ? partToLocalYmd(start) : null}
          onChange={(next) => onChange(next ? { start: next } : null)}
        />
      );
    }

    case "checkbox":
      return (
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
        </div>
      );

    case "person":
      return (
        <FormPersonPicker
          value={value}
          allowMultiple={field.allowMultiple === true}
          onChange={onChange}
          knownUsers={users}
          controlId={controlId}
          ariaLabelledBy={ariaLabelledBy}
          ariaDescribedBy={ariaDescribedBy}
          invalid={invalid}
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
