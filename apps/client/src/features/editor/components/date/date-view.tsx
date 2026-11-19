import { useEffect, useState } from "react";
import { Button, Divider, Group, Popover } from "@mantine/core";
import { DatePicker } from "@mantine/dates";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { addDays, format, formatISO, parseISO } from "date-fns";
import { useTranslation } from "react-i18next";
import { formatDateLabel } from "@docmost/editor-ext";
import { getDateFnsLocale } from "@/lib/date-locale";
import classes from "./date.module.css";

export default function DateView({
  node,
  editor,
  getPos,
  updateAttributes,
}: NodeViewProps) {
  const { t, i18n } = useTranslation();
  const [opened, setOpened] = useState(false);
  const [editable, setEditable] = useState(editor.isEditable);
  const date = node.attrs.date;
  const language = i18n.resolvedLanguage || "en-US";
  const label = formatDateLabel(date, language);
  const locale = getDateFnsLocale(language);

  useEffect(() => {
    if (editor.storage.date.justInserted === node) {
      editor.storage.date.justInserted = null;
      setOpened(editor.isEditable);
    }
  }, [editor, node]);

  useEffect(() => {
    const syncEditable = () => {
      setEditable(editor.isEditable);
      if (!editor.isEditable) setOpened(false);
    };
    editor.on("update", syncEditable);
    return () => {
      editor.off("update", syncEditable);
    };
  }, [editor]);

  const finish = (value?: string | null) => {
    setOpened(false);
    const pos = getPos();
    if (!editor.isEditable || typeof pos !== "number") return;
    if (value && value !== date) updateAttributes({ date: value });
    editor.commands.focus(pos + node.nodeSize);
  };

  const calendarLabel = (day: string, pattern: string) =>
    format(parseISO(day), pattern, { locale });

  const dayLabel = (
    <time dateTime={label ? date : undefined}>{label || t("Date")}</time>
  );
  const chip = editable ? (
    <button
      type="button"
      className={classes.chip}
      aria-haspopup="dialog"
      aria-expanded={opened}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => opened ? finish() : setOpened(true)}
    >
      {dayLabel}
    </button>
  ) : (
    <span className={classes.chip}>{dayLabel}</span>
  );

  return (
    <NodeViewWrapper as="span" contentEditable={false}>
      {opened && editable ? (
        <Popover
          opened
          onChange={setOpened}
          position="bottom-start"
          width="auto"
          offset={5}
          shadow="md"
          trapFocus
          withinPortal
          closeOnEscape={false}
        >
          <Popover.Target>{chip}</Popover.Target>
          <Popover.Dropdown
            p="xs"
            onKeyDownCapture={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                finish();
              }
            }}
          >
            <DatePicker
              value={label ? date : null}
              defaultDate={label ? date : undefined}
              onChange={finish}
              firstDayOfWeek={locale.options?.weekStartsOn}
              weekendDays={[]}
              monthLabelFormat={(day) =>
                parseISO(day).toLocaleDateString(language, {
                  month: "long",
                  year: "numeric",
                })
              }
              weekdayFormat={(day) => calendarLabel(day, "EEEEEE")}
              getMonthControlProps={(day) => ({
                children: calendarLabel(day, "LLL"),
              })}
              getDayAriaLabel={(day) => calendarLabel(day, "PPPP")}
              getDayProps={(day) => ({
                "data-autofocus": day === date || undefined,
                "aria-pressed": day === date,
              })}
              previousLabel={t("Previous")}
              nextLabel={t("Next")}
              highlightToday
            />
            <Divider my={6} />
            <Group gap={4}>
              {[
                { label: t("Today"), days: 0 },
                { label: t("Tomorrow"), days: 1 },
              ].map(({ label, days }) => (
                <Button
                  key={days}
                  size="compact-sm"
                  variant="subtle"
                  color="gray"
                  onClick={() =>
                    finish(formatISO(addDays(new Date(), days), { representation: "date" }))
                  }
                >
                  {label}
                </Button>
              ))}
            </Group>
          </Popover.Dropdown>
        </Popover>
      ) : (
        chip
      )}
    </NodeViewWrapper>
  );
}
