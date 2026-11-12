import { Ref, useCallback, useEffect, useRef, useState } from "react";
import { Collapse, Menu, Switch, UnstyledButton } from "@mantine/core";
import { DatePicker, TimePicker } from "@mantine/dates";
import { IconCheck, IconChevronDown } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import {
  INVALID_DATE,
  instantToWall,
  normalizeDateCell,
  partKind,
  type DateCell,
  type DateKind,
} from "@docmost/base-formula/client";
import {
  DATE_FORMAT_LABELS,
  DATE_FORMATS,
  DateFormat,
  formatDateCell,
  formatZoneLabel,
  resolveTimeFormat,
  TIME_FORMAT_LABELS,
  TimeFormat,
} from "@/ee/base/utils/date-format";
import {
  dateCellsEqual,
  MAX_PICKER_DATE,
  MIN_PICKER_DATE,
  partDayIn,
} from "@/ee/base/utils/date-cell";
import { useViewerDateContext } from "@/ee/base/hooks/use-viewer-date-context";
import {
  DateEndpoint,
  pickDay,
  setTimeOfDay,
} from "./date-edit";
import classes from "./date-value-picker.module.css";

type DateValuePickerProps = {
  value: DateCell | null;
  kind: DateKind;
  onChange: (next: DateCell | null) => void;
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

function usableCell(value: DateCell | null, timeZone: string): DateCell | null {
  if (!value) return null;
  const parts = value.end ? [value.start, value.end] : [value.start];
  return parts.every((part) => partDayIn(part, timeZone) !== null) ? value : null;
}

export function DateValuePicker({
  value,
  kind,
  onChange,
  dateFormat,
  timeFormat,
  onPropertyFormatChange,
}: DateValuePickerProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const { timeZone, today } = useViewerDateContext();
  const [current, setCurrent] = useState(() => usableCell(value, timeZone));
  const [syncedValue, setSyncedValue] = useState(value);
  const [endOn, setEndOn] = useState(!!value?.end);
  const [active, setActive] = useState<DateEndpoint>("start");
  const [month, setMonth] = useState(
    () => (current && partDayIn(current.start, timeZone)) || today,
  );
  const [lastEnd, setLastEnd] = useState(current?.end ?? null);
  const startButtonRef = useRef<HTMLButtonElement>(null);

  if (!dateCellsEqual(value, syncedValue)) {
    setSyncedValue(value);
    setCurrent(usableCell(value, timeZone));
    if (value?.end) setEndOn(true);
  }
  if (current?.end && current.end !== lastEnd) {
    setLastEnd(current.end);
  }

  const includeTime = kind === "datetime";
  const activeEndpoint: DateEndpoint = endOn ? active : "start";
  const resolvedDateFormat: DateFormat = DATE_FORMATS.includes(dateFormat)
    ? dateFormat
    : "medium";
  const resolvedTimeFormat = resolveTimeFormat(timeFormat, locale);
  const startYmd = current ? partDayIn(current.start, timeZone) : null;
  const endYmd =
    current && endOn
      ? partDayIn(current.end ?? current.start, timeZone)
      : null;

  const emit = (next: DateCell | null) => {
    if (next === null) {
      if (current === null) return;
      setCurrent(null);
      onChange(null);
      return;
    }
    const normalized = normalizeDateCell(next, kind);
    if (normalized === INVALID_DATE || normalized === null) return;
    if (dateCellsEqual(normalized, current)) return;
    setCurrent(normalized);
    onChange(normalized);
  };

  const activate = (endpoint: DateEndpoint) => {
    setActive(endpoint);
    const part = endpoint === "start" ? current?.start : current?.end;
    const day = part ? partDayIn(part, timeZone) : null;
    if (day) setMonth(day);
  };

  const selectDay = (ymd: string) => {
    emit(
      pickDay({
        current,
        kind,
        endpoint: activeEndpoint,
        withEnd: endOn,
        ymd,
        zone: timeZone,
      }),
    );
    if (endOn && activeEndpoint === "start") setActive("end");
  };

  const toggleEnd = (on: boolean) => {
    if (on === endOn) return;
    setEndOn(on);
    setActive(on ? "end" : "start");
    if (!current) return;
    if (!on) {
      if (current.end) emit({ start: current.start });
      return;
    }
    if (kind === "datetime" && !current.end) {
      emit({
        start: current.start,
        end: new Date(Date.parse(current.start) + HOUR_MS).toISOString(),
      });
    }
  };

  const commitTime = (endpoint: DateEndpoint, hour: number, minute: number) => {
    if (!current || !includeTime) return;
    emit(setTimeOfDay({ current, endpoint, hour, minute, zone: timeZone }));
  };

  const clear = () => {
    setActive("start");
    emit(null);
    startButtonRef.current?.focus();
  };

  const activeYmd = activeEndpoint === "end" ? endYmd : startYmd;

  const getDayProps = (date: string) => {
    if (!startYmd) {
      return date === today ? { "data-autofocus": true } : {};
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
    paired: endOn,
    dateFormat: resolvedDateFormat,
    timeFormat: resolvedTimeFormat,
    locale,
    timeZone,
    today,
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
          expanded={endOn}
          transitionDuration={COLLAPSE_MS}
          keepMounted={false}
        >
          <div className={classes.endField}>
            <DateField
              {...fieldProps}
              label={t("End")}
              timeLabel={t("End time")}
              part={current?.end ?? (endOn ? (current?.start ?? null) : lastEnd)}
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
          checked={endOn}
          onChange={(event) => toggleEnd(event.currentTarget.checked)}
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
              example: formatDateCell(
                { start: today },
                { dateFormat: format, locale, timeZone, today },
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
  timeZone: string;
  today: string;
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
  timeZone,
  today,
  buttonRef,
  onActivate,
  onTimeCommit,
}: DateFieldProps) {
  const { t } = useTranslation();
  const day = part ? partDayIn(part, timeZone) : null;
  const text = day
    ? formatDateCell(
        { start: day },
        { dateFormat, locale, timeZone, today },
      )
    : "";
  const zone =
    part && day && partKind(part) === "datetime"
      ? formatZoneLabel(part, timeZone, locale)
      : null;

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
      {part && zone !== null && (
        <>
          <TimeField
            part={part}
            format={timeFormat}
            timeZone={timeZone}
            label={t("{{label}}, {{zone}}", { label: timeLabel, zone })}
            onFocus={onActivate}
            onCommit={onTimeCommit}
          />
          <span className={classes.zone} title={timeZone} aria-hidden>
            {zone}
          </span>
        </>
      )}
    </div>
  );
}

type TimeFieldProps = {
  part: string;
  format: TimeFormat;
  timeZone: string;
  label: string;
  onFocus: () => void;
  onCommit: (hours: number, minutes: number) => void;
};

function TimeField({
  part,
  format,
  timeZone,
  label,
  onFocus,
  onCommit,
}: TimeFieldProps) {
  const { t } = useTranslation();
  const wall = instantToWall(part, timeZone);
  const committed = `${String(wall.hour).padStart(2, "0")}:${String(wall.minute).padStart(2, "0")}`;
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
