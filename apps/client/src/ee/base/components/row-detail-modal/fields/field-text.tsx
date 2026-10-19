import { useEffect, useState } from "react";
import { useDebouncedCallback } from "@mantine/hooks";
import { IconExternalLink, IconMail } from "@tabler/icons-react";
import { FieldProps, FieldShell } from "./detail-field";
import classes from "@/ee/base/styles/row-detail-modal.module.css";
import { AUTOSAVE_DELAY_MS } from "@/ee/base/constants/autosave";

const toText = (value: unknown) => (typeof value === "string" ? value : "");

export function FieldText({
  property,
  value,
  readOnly,
  onChange,
  onEditingChange,
}: FieldProps) {
  const text = toText(value);
  const [draft, setDraft] = useState(text);
  const [focused, setFocused] = useState(false);

  // Track remote/navigation updates while not typing.
  useEffect(() => {
    if (!focused) setDraft(text);
  }, [text, focused]);

  const save = () => {
    if (draft !== text) onChange(draft);
  };
  const autosave = useDebouncedCallback(save, AUTOSAVE_DELAY_MS);

  const commit = () => {
    setFocused(false);
    onEditingChange?.(false);
    autosave.cancel();
    save();
  };

  if (readOnly) {
    return (
      <FieldShell>
        <span className={classes.fieldValueText}>{text}</span>
      </FieldShell>
    );
  }

  const linkHref =
    !focused && text
      ? property.type === "email"
        ? text.includes("@")
          ? `mailto:${text}`
          : null
        : property.type === "url" && /^https?:\/\//i.test(text)
          ? text
          : null
      : null;

  return (
    <FieldShell cursor="text">
      <input
        type="text"
        className={classes.fieldInput}
        value={draft}
        maxLength={1000}
        onFocus={() => {
          setFocused(true);
          onEditingChange?.(true);
        }}
        onChange={(e) => {
          setDraft(e.currentTarget.value);
          autosave();
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          } else if (e.key === "Escape") {
            e.currentTarget.blur();
          }
        }}
        aria-label={property.name}
      />
      {linkHref && (
        <a
          href={linkHref}
          target={property.type === "url" ? "_blank" : undefined}
          rel="noopener noreferrer"
          className={classes.fieldTrailing}
          onMouseDown={(e) => e.stopPropagation()}
          aria-label={property.type === "email" ? `Email ${text}` : `Open ${text}`}
        >
          {property.type === "email" ? (
            <IconMail size={14} />
          ) : (
            <IconExternalLink size={14} />
          )}
        </a>
      )}
    </FieldShell>
  );
}
