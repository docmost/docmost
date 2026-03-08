import { useCallback } from "react";
import { Popover } from "@mantine/core";
import { DatePicker } from "@mantine/dates";
import {
  IBaseProperty,
  DateTypeOptions,
} from "@/features/base/types/base.types";
import cellClasses from "@/features/base/styles/cells.module.css";

type CellDateProps = {
  value: unknown;
  property: IBaseProperty;
  rowId: string;
  isEditing: boolean;
  onCommit: (value: unknown) => void;
  onCancel: () => void;
};

function formatDateDisplay(
  dateStr: string | null | undefined,
  options: DateTypeOptions | undefined,
): string {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "";

    const months = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];
    const month = months[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();

    let result = `${month} ${day}, ${year}`;

    if (options?.includeTime) {
      if (options.timeFormat === "24h") {
        const hours = String(date.getHours()).padStart(2, "0");
        const minutes = String(date.getMinutes()).padStart(2, "0");
        result += ` ${hours}:${minutes}`;
      } else {
        let hours = date.getHours();
        const ampm = hours >= 12 ? "PM" : "AM";
        hours = hours % 12 || 12;
        const minutes = String(date.getMinutes()).padStart(2, "0");
        result += ` ${hours}:${minutes} ${ampm}`;
      }
    }

    return result;
  } catch {
    return "";
  }
}

function toISODateString(dateStr: string | null): string | null {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  } catch {
    return null;
  }
}

export function CellDate({
  value,
  property,
  isEditing,
  onCommit,
  onCancel,
}: CellDateProps) {
  const typeOptions = property.typeOptions as DateTypeOptions | undefined;
  const dateStr = typeof value === "string" ? value : null;
  const pickerValue = toISODateString(dateStr);

  const handleChange = useCallback(
    (selected: string | null) => {
      if (selected) {
        const date = new Date(selected);
        onCommit(date.toISOString());
      } else {
        onCommit(null);
      }
    },
    [onCommit],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    },
    [onCancel],
  );

  if (isEditing) {
    return (
      <Popover
        opened
        onClose={onCancel}
        position="bottom-start"
        width="auto"
        trapFocus
      >
        <Popover.Target>
          <div style={{ width: "100%", height: "100%" }}>
            <span className={cellClasses.dateValue}>
              {formatDateDisplay(dateStr, typeOptions)}
            </span>
          </div>
        </Popover.Target>
        <Popover.Dropdown p="xs" onKeyDown={handleKeyDown}>
          <DatePicker
            value={pickerValue}
            onChange={handleChange}
            size="sm"
          />
        </Popover.Dropdown>
      </Popover>
    );
  }

  if (!dateStr) {
    return <span className={cellClasses.emptyValue} />;
  }

  return (
    <span className={cellClasses.dateValue}>
      {formatDateDisplay(dateStr, typeOptions)}
    </span>
  );
}
