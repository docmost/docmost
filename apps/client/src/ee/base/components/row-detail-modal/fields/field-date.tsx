import { useState } from "react";
import { Popover } from "@mantine/core";
import { DatePicker } from "@mantine/dates";
import { DateTypeOptions } from "@/ee/base/types/base.types";
import { formatDateDisplay } from "@/ee/base/components/cells/cell-date";
import { FieldProps, FieldShell } from "./detail-field";
import classes from "@/ee/base/styles/row-detail-modal.module.css";

function toISODateString(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function FieldDate({ property, value, readOnly, onChange }: FieldProps) {
  const [opened, setOpened] = useState(false);
  const typeOptions = property.typeOptions as DateTypeOptions | undefined;
  const dateStr = typeof value === "string" ? value : null;
  const display = formatDateDisplay(dateStr, typeOptions);

  if (readOnly) {
    return (
      <FieldShell>
        <span className={classes.fieldValueText}>{display}</span>
      </FieldShell>
    );
  }

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      position="bottom-start"
      width="auto"
      shadow="md"
      withinPortal
      trapFocus
      closeOnClickOutside
      closeOnEscape
      hideDetached={false}
    >
      <Popover.Target>
        <FieldShell
          cursor="pointer"
          active={opened}
          role="button"
          tabIndex={0}
          aria-label={property.name}
          onClick={() => setOpened((o) => !o)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setOpened((o) => !o);
            }
          }}
        >
          <span className={classes.fieldValueText}>{display}</span>
        </FieldShell>
      </Popover.Target>
      <Popover.Dropdown p="xs">
        <DatePicker
          value={toISODateString(dateStr)}
          onChange={(selected) => {
            onChange(selected ? new Date(selected).toISOString() : null);
            setOpened(false);
          }}
          size="sm"
        />
      </Popover.Dropdown>
    </Popover>
  );
}
