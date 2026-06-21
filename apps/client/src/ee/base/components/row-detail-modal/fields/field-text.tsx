import { useEffect, useRef, useState } from "react";
import { IconExternalLink, IconMail } from "@tabler/icons-react";
import { FieldProps, FieldShell } from "./detail-field";
import classes from "@/ee/base/styles/row-detail-modal.module.css";

const toText = (value: unknown) => (typeof value === "string" ? value : "");

export function FieldText({ property, value, readOnly, onChange }: FieldProps) {
  const text = toText(value);
  const [draft, setDraft] = useState(text);
  const [focused, setFocused] = useState(false);
  // Esc sets this; blur() then runs commit synchronously with the stale
  // draft, so the revert must be decided here, not via setDraft.
  const cancelRef = useRef(false);

  // Track remote/navigation updates while not typing.
  useEffect(() => {
    if (!focused) setDraft(text);
  }, [text, focused]);

  const commit = () => {
    setFocused(false);
    if (cancelRef.current) {
      cancelRef.current = false;
      setDraft(text);
      return;
    }
    if (draft !== text) onChange(draft);
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
        onFocus={() => setFocused(true)}
        onChange={(e) => setDraft(e.currentTarget.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          } else if (e.key === "Escape") {
            cancelRef.current = true;
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
