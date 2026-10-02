import { useRef, useState } from "react";
import { Popover } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { DateTypeOptions } from "@/ee/base/types/base.types";
import { DateCellPicker } from "@/ee/base/components/cells/cell-date";
import { formatDateValue, parseDateValue } from "@/ee/base/utils/date-value";
import { FieldProps, FieldShell } from "./detail-field";
import classes from "@/ee/base/styles/row-detail-modal.module.css";

export function FieldDate({ property, value, readOnly, onChange }: FieldProps) {
  const { i18n } = useTranslation();
  const [opened, setOpened] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);
  const typeOptions = property.typeOptions as DateTypeOptions | undefined;
  const dateValue = parseDateValue(value);
  const display = formatDateValue(dateValue, {
    dateFormat: typeOptions?.dateFormat,
    timeFormat: typeOptions?.timeFormat,
    locale: i18n.language,
  });

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
      middlewares={{ flip: true, shift: { crossAxis: true, padding: 8 } }}
      shadow="md"
      withinPortal
      trapFocus
      closeOnClickOutside
      closeOnEscape
      hideDetached={false}
    >
      <Popover.Target>
        <FieldShell
          ref={shellRef}
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
      <Popover.Dropdown
        p={0}
        onKeyDown={(e) => {
          if (e.key === "Escape") shellRef.current?.focus();
        }}
      >
        <DateCellPicker
          property={property}
          value={dateValue}
          onChange={onChange}
        />
      </Popover.Dropdown>
    </Popover>
  );
}
