import { useCallback, useState } from "react";
import { Popover } from "@mantine/core";
import { Choice, SelectTypeOptions } from "@/ee/base/types/base.types";
import { choiceColor } from "@/ee/base/components/cells/choice-color";
import { ChoicePicker } from "@/ee/base/components/cells/choice-picker";
import { FieldProps, FieldShell } from "./detail-field";
import classes from "@/ee/base/styles/row-detail-modal.module.css";
import cellClasses from "@/ee/base/styles/cells.module.css";

export function FieldChoice({ property, value, readOnly, onChange }: FieldProps) {
  const [opened, setOpened] = useState(false);
  const multiple = property.type === "multiSelect";
  const choices =
    (property.typeOptions as SelectTypeOptions | undefined)?.choices ?? [];

  const selectedIds = multiple
    ? Array.isArray(value)
      ? (value as string[])
      : []
    : typeof value === "string"
      ? [value]
      : [];
  const selectedChoices = choices.filter((c) => selectedIds.includes(c.id));

  const handleToggle = useCallback(
    (choice: Choice) => {
      if (multiple) {
        const next = selectedIds.includes(choice.id)
          ? selectedIds.filter((id) => id !== choice.id)
          : [...selectedIds, choice.id];
        onChange(next.length > 0 ? next : null);
      } else {
        onChange(choice.id === selectedIds[0] ? null : choice.id);
        setOpened(false);
      }
    },
    [multiple, selectedIds, onChange],
  );

  const chips = selectedChoices.map((choice) => (
    <span
      key={choice.id}
      className={cellClasses.badge}
      style={choiceColor(choice.color)}
    >
      {choice.name}
    </span>
  ));

  if (readOnly) {
    return (
      <FieldShell>
        <div className={classes.fieldChips}>{chips}</div>
      </FieldShell>
    );
  }

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      position="bottom-start"
      width="target"
      shadow="md"
      withinPortal
      trapFocus
      closeOnClickOutside
      closeOnEscape={false}
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
          <div className={classes.fieldChips}>{chips}</div>
        </FieldShell>
      </Popover.Target>
      <Popover.Dropdown p={4}>
        {opened && (
          <ChoicePicker
            property={property}
            selectedIds={selectedIds}
            multiple={multiple}
            grouped={property.type === "status"}
            allowCreate={property.type !== "status"}
            onToggle={handleToggle}
            onEscape={() => setOpened(false)}
          />
        )}
      </Popover.Dropdown>
    </Popover>
  );
}
