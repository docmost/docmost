import { Ref, useCallback, useEffect, useRef, useState } from "react";
import { Collapse, Menu, Switch, UnstyledButton } from "@mantine/core";
import { DatePicker, TimePicker } from "@mantine/dates";
import { IconCheck, IconChevronDown } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import {
  DATE_FORMAT_LABELS,
  DATE_FORMATS,
  DateFormat,
  DateValue,
  dateValuesEqual,
  formatDateValue,
  isDateOnly,
  localDateToYmd,
  localPartsToInstant,
  MAX_PICKER_DATE,
  MIN_PICKER_DATE,
  partToLocalYmd,
  resolveTimeFormat,
  TIME_FORMAT_LABELS,
} from "@/ee/base/utils/date-value";
import classes from "./date-value-picker.module.css";

type TimeFormat = "12h" | "24h";
type Endpoint = "start" | "end";

type DateValuePickerProps = {
  value: DateValue | null;
  onChange: (next: DateValue | null) => void;
  defaultIncludeTime?: boolean;
  dateFormat?: DateFormat;
  timeFormat?: TimeFormat;
  onPropertyFormatChange?: (patch: {
    dateFormat?: DateFormat;
    timeFormat?: TimeFormat;
  }) => void;
};

const TIME_FORMATS: TimeFormat[] = ["12h", "24h"];
const HOUR_MS = 3_600_000;
const COLLAPSE_MS = 150;

const SWITCH_CLASS_NAMES = {
  body: classes.toggle,
  labelWrapper: classes.toggleLabelWrapper,
};

function partTime(part: string): string {
  const date = new Date(part);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function moveToDay(part: string, ymd: string): string {
  if (isDateOnly(part)) return ymd;
  const date = new Date(part);
  return localPartsToInstant(ymd, date.getHours(), date.getMinutes());
}

function isAfter(a: string, b: string): boolean {
  return isDateOnly(a) ? a > b : Date.parse(a) > Date.parse(b);
}

function shiftInstant(part: string, ms: number): string {
  return new Date(Date.parse(part) + ms).toISOString();
}

export function DateValuePicker({
  value,
  onChange,
  defaultIncludeTime = false,
  dateFormat,
  timeFormat,
  onPropertyFormatChange,
}: DateValuePickerProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const [current, setCurrent] = useState(value);
  const [syncedValue, setSyncedValue] = useState(value);
  const [pendingIncludeTime, setPendingIncludeTime] =
    useState(defaultIncludeTime);
  const [pendingEnd, setPendingEnd] = useState(false);
  const [active, setActive] = useState<Endpoint>("start");
  const [month, setMonth] = useState(() =>
    value ? partToLocalYmd(value.start) : localDateToYmd(new Date()),
  );
  const [lastEnd, setLastEnd] = useState(value?.end ?? null);
  const startButtonRef = useRef<HTMLButtonElement>(null);

  if (!dateValuesEqual(value, syncedValue)) {
    setSyncedValue(value);
    setCurrent(value);
  }
  if (current?.end && current.end !== lastEnd) {
    setLastEnd(current.end);
  }

  const includeTime = current ? !isDateOnly(current.start) : pendingIncludeTime;
  const endEnabled = current ? !!current.end : pendingEnd;
  const activeEndpoint: Endpoint = endEnabled ? active : "start";
  const resolvedDateFormat: DateFormat = DATE_FORMATS.includes(dateFormat)
    ? dateFormat
    : "medium";
  const resolvedTimeFormat = resolveTimeFormat(timeFormat, locale);
  const todayYmd = localDateToYmd(new Date());
  const startYmd = current ? partToLocalYmd(current.start) : null;
  const endYmd = current?.end ? partToLocalYmd(current.end) : null;

  const emit = (next: DateValue | null) => {
    if (dateValuesEqual(next, current)) return;
    setCurrent(next);
    onChange(next);
  };

  const activate = (endpoint: Endpoint) => {
    setActive(endpoint);
    const part = endpoint === "start" ? current?.start : current?.end;
    if (part) setMonth(partToLocalYmd(part));
  };

  const selectDay = (ymd: string) => {
    if (!current) {
      const start = includeTime ? localPartsToInstant(ymd, 9, 0) : ymd;
      if (!endEnabled) {
        emit({ start });
        return;
      }
      emit({ start, end: includeTime ? shiftInstant(start, HOUR_MS) : start });
      setActive("end");
      return;
    }
    if (!current.end) {
      emit({ start: moveToDay(current.start, ymd) });
      return;
    }
    if (activeEndpoint === "start") {
      const start = moveToDay(current.start, ymd);
      emit({ start, end: isAfter(start, current.end) ? start : current.end });
      setActive("end");
      return;
    }
    if (ymd < startYmd) {
      emit({ start: moveToDay(current.start, ymd), end: current.end });
      return;
    }
    const end = moveToDay(current.end, ymd);
    emit({
      start: current.start,
      end: isAfter(current.start, end) ? current.start : end,
    });
  };

  const toggleIncludeTime = (on: boolean) => {
    if (!current) {
      setPendingIncludeTime(on);
      return;
    }
    if (on === includeTime) return;
    const convert = (part: string, hour: number) => {
      const ymd = partToLocalYmd(part);
      return on ? localPartsToInstant(ymd, hour, 0) : ymd;
    };
    emit(
      current.end
        ? { start: convert(current.start, 9), end: convert(current.end, 10) }
        : { start: convert(current.start, 9) },
    );
  };

  const toggleEnd = (on: boolean) => {
    if (!current) {
      setPendingEnd(on);
      return;
    }
    if (on === !!current.end) return;
    setActive(on ? "end" : "start");
    if (!on) {
      emit({ start: current.start });
      return;
    }
    emit({
      start: current.start,
      end: isDateOnly(current.start)
        ? current.start
        : shiftInstant(current.start, HOUR_MS),
    });
  };

  const commitTime = (endpoint: Endpoint, hours: number, minutes: number) => {
    if (!current || isDateOnly(current.start)) return;
    if (endpoint === "start") {
      const start = localPartsToInstant(
        partToLocalYmd(current.start),
        hours,
        minutes,
      );
      if (!current.end) {
        emit({ start });
        return;
      }
      const delta = Date.parse(start) - Date.parse(current.start);
      emit({ start, end: shiftInstant(current.end, delta) });
      return;
    }
    if (!current.end) return;
    const end = localPartsToInstant(
      partToLocalYmd(current.end),
      hours,
      minutes,
    );
    emit({
      start: current.start,
      end: isAfter(current.start, end) ? current.start : end,
    });
  };

  const clear = () => {
    setPendingIncludeTime(includeTime);
    setPendingEnd(endEnabled);
    setActive("start");
    emit(null);
    startButtonRef.current?.focus();
  };

  const activeYmd = activeEndpoint === "end" ? endYmd : startYmd;

  const getDayProps = (date: string) => {
    if (!startYmd) {
      return date === todayYmd ? { "data-autofocus": true } : {};
    }
    if (!endYmd) return { selected: date === startYmd };
    return {
      selected: date === activeYmd,
      "data-selected": date === startYmd || date === endYmd || undefined,
      inRange: date >= startYmd && date <= endYmd,
      firstInRange: date === startYmd,
      lastInRange: date === endYmd,
    };
  };

  const fieldProps = {
    paired: endEnabled,
    dateFormat: resolvedDateFormat,
    timeFormat: resolvedTimeFormat,
    locale,
  };

  return (
    <div className={classes.root}>
      <div className={classes.header}>
        <DateField
          {...fieldProps}
          buttonRef={startButtonRef}
          label={t("Start")}
          timeLabel={t("Start time")}
          part={current?.start ?? null}
          active={activeEndpoint === "start"}
          onActivate={() => activate("start")}
          onTimeCommit={(hours, minutes) =>
            commitTime("start", hours, minutes)
          }
        />
        <Collapse
          expanded={endEnabled}
          transitionDuration={COLLAPSE_MS}
          keepMounted={false}
        >
          <div className={classes.endField}>
            <DateField
              {...fieldProps}
              label={t("End")}
              timeLabel={t("End time")}
              part={current?.end ?? (endEnabled ? null : lastEnd)}
              active={activeEndpoint === "end"}
              onActivate={() => activate("end")}
              onTimeCommit={(hours, minutes) =>
                commitTime("end", hours, minutes)
              }
            />
          </div>
        </Collapse>
      </div>

      <DatePicker
        className={classes.calendar}
        classNames={{
          day: classes.day,
          calendarHeaderControl: classes.headerControl,
          calendarHeaderLevel: classes.headerLevel,
        }}
        size="sm"
        fullWidth
        withCellSpacing={false}
        highlightToday
        weekendDays={[]}
        minDate={MIN_PICKER_DATE}
        maxDate={MAX_PICKER_DATE}
        value={activeYmd}
        onChange={(date) => {
          if (date) selectDay(date);
        }}
        date={month}
        onDateChange={setMonth}
        getDayProps={getDayProps}
        ariaLabels={{
          previousMonth: t("Previous month"),
          nextMonth: t("Next month"),
          previousYear: t("Previous year"),
          nextYear: t("Next year"),
          previousDecade: t("Previous decade"),
          nextDecade: t("Next decade"),
        }}
      />

      <div className={classes.section}>
        <Switch
          size="xs"
          labelPosition="left"
          label={t("End date")}
          checked={endEnabled}
          onChange={(event) => toggleEnd(event.currentTarget.checked)}
          classNames={SWITCH_CLASS_NAMES}
        />
        <Switch
          size="xs"
          labelPosition="left"
          label={t("Include time")}
          checked={includeTime}
          onChange={(event) => toggleIncludeTime(event.currentTarget.checked)}
          classNames={SWITCH_CLASS_NAMES}
        />
      </div>

      {onPropertyFormatChange && (
        <div className={classes.section}>
          <FormatMenu
            label={t("Date format")}
            value={resolvedDateFormat}
            options={DATE_FORMATS.map((format) => ({
              value: format,
              label: t(DATE_FORMAT_LABELS[format]),
              example: formatDateValue(
                { start: todayYmd },
                { dateFormat: format, locale },
              ),
            }))}
            onChange={(format) => onPropertyFormatChange({ dateFormat: format })}
          />
          <Collapse
            expanded={includeTime}
            transitionDuration={COLLAPSE_MS}
            keepMounted={false}
          >
            <FormatMenu
              label={t("Time format")}
              value={resolvedTimeFormat}
              options={TIME_FORMATS.map((format) => ({
                value: format,
                label: t(TIME_FORMAT_LABELS[format]),
              }))}
              onChange={(format) =>
                onPropertyFormatChange({ timeFormat: format })
              }
            />
          </Collapse>
        </div>
      )}

      {current && (
        <div className={classes.section}>
          <UnstyledButton className={classes.row} onClick={clear}>
            {t("Clear")}
          </UnstyledButton>
        </div>
      )}
    </div>
  );
}

type DateFieldProps = {
  label: string;
  timeLabel: string;
  part: string | null;
  active: boolean;
  paired: boolean;
  dateFormat: DateFormat;
  timeFormat: TimeFormat;
  locale: string;
  buttonRef?: Ref<HTMLButtonElement>;
  onActivate: () => void;
  onTimeCommit: (hours: number, minutes: number) => void;
};

function DateField({
  label,
  timeLabel,
  part,
  active,
  paired,
  dateFormat,
  timeFormat,
  locale,
  buttonRef,
  onActivate,
  onTimeCommit,
}: DateFieldProps) {
  const { t } = useTranslation();
  const text = part
    ? formatDateValue(
        { start: partToLocalYmd(part) },
        { dateFormat, locale },
      )
    : "";

  return (
    <div className={classes.field} data-active={active || undefined}>
      <UnstyledButton
        ref={buttonRef}
        className={classes.dateButton}
        aria-pressed={paired ? active : undefined}
        aria-label={
          text ? t("{{label}}: {{date}}", { label, date: text }) : label
        }
        onClick={onActivate}
      >
        <span className={text ? classes.dateText : classes.placeholder}>
          {text || label}
        </span>
      </UnstyledButton>
      {part && !isDateOnly(part) && (
        <TimeField
          part={part}
          format={timeFormat}
          label={timeLabel}
          onFocus={onActivate}
          onCommit={onTimeCommit}
        />
      )}
    </div>
  );
}

type TimeFieldProps = {
  part: string;
  format: TimeFormat;
  label: string;
  onFocus: () => void;
  onCommit: (hours: number, minutes: number) => void;
};

function TimeField({ part, format, label, onFocus, onCommit }: TimeFieldProps) {
  const { t } = useTranslation();
  const committed = partTime(part);
  const [draft, setDraft] = useState(committed);
  const [syncedTime, setSyncedTime] = useState(committed);
  const [resetKey, setResetKey] = useState(0);
  const pendingRef = useRef<string | null>(null);
  const pendingBaseRef = useRef<string | null>(null);
  const partRef = useRef(part);
  const committedRef = useRef(committed);
  const onCommitRef = useRef(onCommit);
  partRef.current = part;
  committedRef.current = committed;
  onCommitRef.current = onCommit;

  if (committed !== syncedTime) {
    pendingRef.current = null;
    setSyncedTime(committed);
    setDraft(committed);
  }

  const flush = useCallback(() => {
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (!pending || pending === committedRef.current) return;
    const [hours, minutes] = pending.split(":").map(Number);
    onCommitRef.current(hours, minutes);
    setDraft(committedRef.current);
  }, []);

  useEffect(
    () => () => {
      if (pendingBaseRef.current === partRef.current) flush();
    },
    [flush],
  );

  const handleChange = (next: string) => {
    if (pendingRef.current === null) pendingBaseRef.current = part;
    pendingRef.current = next;
    if (next) setDraft(next);
  };

  const handleBlur = () => {
    if (pendingRef.current !== "") {
      flush();
      return;
    }
    pendingRef.current = null;
    setDraft(committed);
    setResetKey((key) => key + 1);
  };

  return (
    <TimePicker
      key={`${format}-${resetKey}`}
      value={draft}
      onChange={handleChange}
      onFocus={onFocus}
      onBlur={handleBlur}
      onKeyDown={(event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        if (pendingRef.current !== "") flush();
      }}
      format={format}
      size="sm"
      variant="unstyled"
      role="group"
      aria-label={label}
      hoursInputLabel={t("Hours")}
      minutesInputLabel={t("Minutes")}
      amPmInputLabel={t("AM/PM")}
      amPmLabels={{ am: t("AM"), pm: t("PM") }}
      classNames={{ root: classes.timeRoot, input: classes.timeInput }}
    />
  );
}

type FormatOption<T extends string> = {
  value: T;
  label: string;
  example?: string;
};

type FormatMenuProps<T extends string> = {
  label: string;
  value: T;
  options: FormatOption<T>[];
  onChange: (value: T) => void;
};

function FormatMenu<T extends string>({
  label,
  value,
  options,
  onChange,
}: FormatMenuProps<T>) {
  const [opened, setOpened] = useState(false);

  useEffect(() => {
    if (!opened) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setOpened(false);
    };
    window.addEventListener("keydown", closeOnEscape, true);
    return () => window.removeEventListener("keydown", closeOnEscape, true);
  }, [opened]);

  return (
    <Menu
      opened={opened}
      onChange={setOpened}
      position="bottom-end"
      offset={4}
      shadow="md"
      withinPortal={false}
      hideDetached={false}
      checkIcon={<IconCheck size={14} />}
    >
      <Menu.Target>
        <UnstyledButton className={classes.row}>
          <span className={classes.rowLabel}>{label}</span>
          <span className={classes.rowValue}>
            {options.find((option) => option.value === value)?.label}
          </span>
          <IconChevronDown size={14} className={classes.rowChevron} />
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.RadioGroup
          value={value}
          onChange={(next) => onChange(next as T)}
        >
          {options.map((option) => (
            <Menu.RadioItem
              key={option.value}
              value={option.value}
              closeMenuOnClick
              rightSection={
                option.example && (
                  <span className={classes.example}>{option.example}</span>
                )
              }
            >
              {option.label}
            </Menu.RadioItem>
          ))}
        </Menu.RadioGroup>
      </Menu.Dropdown>
    </Menu>
  );
}
