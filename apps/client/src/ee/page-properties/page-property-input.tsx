import { useLayoutEffect, useRef, useState } from "react";
import { Checkbox, Popover } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { ChoicePicker } from "@/ee/base/components/cells/choice-picker";
import { DateValuePicker } from "@/ee/base/components/date-picker/date-value-picker";
import { FieldText } from "@/ee/base/components/row-detail-modal/fields/field-text";
import { FieldLongText } from "@/ee/base/components/row-detail-modal/fields/field-long-text";
import { FieldNumber } from "@/ee/base/components/row-detail-modal/fields/field-number";
import { useDateCellDisplay } from "@/ee/base/hooks/use-date-cell-display";
import { dateTypeOptionsOf } from "@/ee/base/utils/date-format";
import type {
  PageProperty,
  SavePagePropertyChoices,
} from "./page-property.types";
import { PagePropertyValue } from "./page-property-value";
import classes from "./page-properties.module.css";

type Props = {
  property: PageProperty;
  onChange: (value: unknown) => void;
  onSaveChoices: SavePagePropertyChoices;
};

function PageDatePicker({
  property,
  onChange,
}: Pick<Props, "property" | "onChange">) {
  const { kind, cell } = useDateCellDisplay(property, property.value);
  const { dateFormat, timeFormat } = dateTypeOptionsOf(property.typeOptions);
  return (
    <DateValuePicker
      kind={kind}
      value={cell}
      onChange={onChange}
      dateFormat={dateFormat}
      timeFormat={timeFormat}
    />
  );
}

function PageChoicePicker({
  property,
  onChange,
  onSaveChoices,
  onClose,
}: Props & { onClose: () => void }) {
  // Bind the revision to the options displayed when the picker opened.
  const [definition, setDefinition] = useState(property);
  const { value } = property;
  const ids: string[] = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? [value]
      : [];
  const multiple = definition.type === "multiSelect";
  return (
    <ChoicePicker
      property={definition}
      selectedIds={ids}
      multiple={multiple}
      allowCreate={definition.type !== "status"}
      grouped={definition.type === "status"}
      onSaveChoices={async (options) => {
        setDefinition(await onSaveChoices(options, definition.schemaVersion));
      }}
      onEscape={onClose}
      onToggle={(choice) => {
        if (multiple) {
          const next = ids.includes(choice.id)
            ? ids.filter((id) => id !== choice.id)
            : [...ids, choice.id];
          onChange(next.length ? next : null);
        } else {
          onChange(ids[0] === choice.id ? null : choice.id);
          onClose();
        }
      }}
    />
  );
}

export function PagePropertyInput({
  property,
  onChange,
  onSaveChoices,
}: Props) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { type, value } = property;
  const label = t("Edit value for {{name}}", { name: property.name });
  useLayoutEffect(() => {
    if (editing)
      inputRef.current?.querySelector<HTMLElement>("input, textarea")?.focus();
  }, [editing]);

  if (type === "checkbox") {
    return (
      <Checkbox
        size="xs"
        aria-label={label}
        checked={value === true}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
    );
  }
  const trigger = (
    <button
      ref={triggerRef}
      type="button"
      className={classes.valueButton}
      aria-label={label}
      onClick={() => setEditing((current) => !current)}
    >
      <PagePropertyValue property={property} />
    </button>
  );
  if (
    type === "select" ||
    type === "status" ||
    type === "multiSelect" ||
    type === "date"
  ) {
    return (
      <Popover
        opened={editing}
        onChange={setEditing}
        position="bottom-start"
        shadow="md"
        width={type === "date" ? "auto" : 260}
        trapFocus
        returnFocus
        withinPortal
        preventPositionChangeWhenVisible={false}
      >
        <Popover.Target>{trigger}</Popover.Target>
        <Popover.Dropdown p={type === "date" ? 0 : 4}>
          {editing &&
            (type === "date" ? (
              <PageDatePicker property={property} onChange={onChange} />
            ) : (
              <PageChoicePicker
                property={property}
                onChange={onChange}
                onSaveChoices={onSaveChoices}
                onClose={() => setEditing(false)}
              />
            ))}
        </Popover.Dropdown>
      </Popover>
    );
  }
  if (!editing) return trigger;
  const Field =
    type === "number"
      ? FieldNumber
      : type === "longText"
        ? FieldLongText
        : FieldText;
  return (
    <div
      ref={inputRef}
      className={classes.inlineEditor}
      onKeyDownCapture={(event) => {
        if (
          event.key === "Escape" ||
          (event.key === "Enter" &&
            (type !== "longText" || event.ctrlKey || event.metaKey))
        ) {
          requestAnimationFrame(() => triggerRef.current?.focus());
        }
      }}
    >
      <Field
        property={property}
        value={value}
        readOnly={false}
        rowId={property.pageId}
        onChange={(next) => onChange(next === "" ? null : next)}
        onEditingChange={(focused) => {
          if (!focused) setEditing(false);
        }}
      />
    </div>
  );
}
