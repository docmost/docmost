import { useState } from "react";
import {
  Popover,
  InputBase,
  Input,
  SegmentedControl,
} from "@mantine/core";
import { DatePicker } from "@mantine/dates";
import { isYmd, resolveOperand } from "@docmost/base-formula/client";
import { IconChevronDown } from "@tabler/icons-react";
import clsx from "clsx";
import { useTranslation } from "react-i18next";
import type {
  DateFilterValue,
  FilterOperator,
} from "@/ee/base/types/base.types";
import { useViewerDateContext } from "@/ee/base/hooks/use-viewer-date-context";
import { formatDateCell } from "@/ee/base/utils/date-format";
import {
  DATE_ANCHOR_PRESETS,
  DATE_RANGE_PRESETS,
} from "./relative-date-presets";
import cellClasses from "@/ee/base/styles/cells.module.css";

type FilterDateInputProps = {
  op: FilterOperator;
  value: unknown;
  onChange: (value: unknown) => void;
};

type Mode = "exact" | "relative";

const ANCHOR_LABEL: Record<string, string> = Object.fromEntries(
  DATE_ANCHOR_PRESETS.map((p) => [p.value, p.labelKey]),
);
const RANGE_LABEL: Record<string, string> = Object.fromEntries(
  DATE_RANGE_PRESETS.map((p) => [p.value, p.labelKey]),
);

export function FilterDateInput({ op, value, onChange }: FilterDateInputProps) {
  const { t, i18n } = useTranslation();
  const { timeZone, weekStart, today } = useViewerDateContext();
  const bounds = resolveOperand(value, today, weekStart);
  const current = bounds ? (value as DateFilterValue) : null;

  const [opened, setOpened] = useState(false);
  const [localMode, setLocalMode] = useState<Mode>("exact");

  const day = current?.mode === "exact" && bounds ? bounds.from : null;
  const anchor = current?.mode === "relative" ? current.preset : null;
  const range = current?.mode === "range" ? current.preset : null;

  const valueMode: Mode | null =
    current?.mode === "relative"
      ? "relative"
      : current?.mode === "exact"
        ? "exact"
        : null;
  const mode: Mode = valueMode ?? localMode;

  let triggerLabel: string | null = null;
  if (op === "isWithin") triggerLabel = range ? t(RANGE_LABEL[range]) : null;
  else if (day) {
    triggerLabel = formatDateCell(
      { start: day },
      { dateFormat: "medium", locale: i18n.language, timeZone, today },
    );
  } else if (anchor) triggerLabel = t(ANCHOR_LABEL[anchor]);

  // Consume Escape locally so the outer filter popover (bubble handler) keeps
  // the panel open and only this picker closes.
  const handleEscape = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setOpened(false);
    }
  };

  const presetRow = (
    selected: boolean,
    label: string,
    onClick: () => void,
    key: string,
  ) => (
    <div
      key={key}
      className={clsx(
        cellClasses.selectOption,
        selected && cellClasses.selectOptionActive,
      )}
      onClick={onClick}
    >
      <span className={cellClasses.personOptionName}>{label}</span>
    </div>
  );

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      position="bottom-start"
      width={op === "isWithin" ? 200 : "auto"}
      withinPortal={false}
      closeOnEscape={false}
      closeOnClickOutside
    >
      <Popover.Target>
        <InputBase
          component="button"
          type="button"
          size="xs"
          pointer
          w={170}
          rightSection={<IconChevronDown size={14} />}
          rightSectionPointerEvents="none"
          onClick={() => setOpened((o) => !o)}
          onKeyDown={handleEscape}
        >
          {triggerLabel ?? <Input.Placeholder>{t("Select")}</Input.Placeholder>}
        </InputBase>
      </Popover.Target>
      <Popover.Dropdown p={op === "isWithin" ? 0 : "xs"} onKeyDown={handleEscape}>
        {op === "isWithin" ? (
          <div className={cellClasses.selectDropdown}>
            {DATE_RANGE_PRESETS.map((p) =>
              presetRow(
                range === p.value,
                t(p.labelKey),
                () => {
                  onChange({ mode: "range", preset: p.value });
                  setOpened(false);
                },
                p.value,
              ),
            )}
          </div>
        ) : (
          <>
            <SegmentedControl
              fullWidth
              size="xs"
              mb="xs"
              value={mode}
              onChange={(m) => {
                setLocalMode(m as Mode);
                onChange(undefined);
              }}
              data={[
                { value: "exact", label: t("Date") },
                { value: "relative", label: t("Relative") },
              ]}
            />
            {mode === "exact" ? (
              <DatePicker
                value={day}
                defaultDate={day ?? today}
                onChange={(d) => {
                  onChange(d && isYmd(d) ? { mode: "exact", date: d } : undefined);
                  setOpened(false);
                }}
                size="sm"
              />
            ) : (
              <div className={cellClasses.selectDropdown}>
                {DATE_ANCHOR_PRESETS.map((p) =>
                  presetRow(
                    anchor === p.value,
                    t(p.labelKey),
                    () => {
                      onChange({ mode: "relative", preset: p.value });
                      setOpened(false);
                    },
                    p.value,
                  ),
                )}
              </div>
            )}
          </>
        )}
      </Popover.Dropdown>
    </Popover>
  );
}
