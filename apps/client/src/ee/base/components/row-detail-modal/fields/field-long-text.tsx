import { useEffect, useState } from "react";
import { Textarea } from "@mantine/core";
import { FieldProps, FieldShell } from "./detail-field";
import classes from "@/ee/base/styles/row-detail-modal.module.css";

const toText = (value: unknown) => (typeof value === "string" ? value : "");
const normalize = (s: string) => {
  const trimmed = s.trim();
  return trimmed.length ? trimmed : null;
};

export function FieldLongText({
  property,
  value,
  readOnly,
  onChange,
  onEditingChange,
}: FieldProps) {
  const text = toText(value);
  const [draft, setDraft] = useState(text);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(text);
  }, [text, focused]);

  const commit = () => {
    setFocused(false);
    onEditingChange?.(false);
    if (normalize(draft) !== normalize(text)) onChange(normalize(draft));
  };

  if (readOnly) {
    return (
      <FieldShell alignTop>
        <span className={classes.fieldValueTextMultiline}>{text}</span>
      </FieldShell>
    );
  }

  return (
    <FieldShell cursor="text" alignTop>
      <Textarea
        autosize
        minRows={3}
        maxRows={16}
        maxLength={25000}
        variant="unstyled"
        className={classes.fieldTextarea}
        classNames={{ input: classes.fieldTextareaInput }}
        value={draft}
        onFocus={() => {
          setFocused(true);
          onEditingChange?.(true);
        }}
        onChange={(e) => setDraft(e.currentTarget.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.currentTarget.blur();
          } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
        aria-label={property.name}
      />
    </FieldShell>
  );
}
