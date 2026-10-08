import { useEffect, useRef, useState } from "react";
import { Popover, Textarea, Group, CloseButton, Tooltip } from "@mantine/core";
import { useDebouncedCallback } from "@mantine/hooks";
import { IBaseProperty } from "@/ee/base/types/base.types";
import { formatLongTextPreview } from "@/ee/base/formatters/cell-formatters";
import cellClasses from "@/ee/base/styles/cells.module.css";

type CellLongTextProps = {
  value: unknown;
  property: IBaseProperty;
  rowId: string;
  isEditing: boolean;
  onCommit: (value: unknown) => void;
  onValueChange: (value: unknown) => void;
  onCancel: () => void;
  onTabNavigate?: (shiftKey: boolean) => void;
};

const toText = (value: unknown) => (typeof value === "string" ? value : "");
const normalize = (s: string) => {
  const trimmed = s.trim();
  return trimmed.length ? trimmed : null;
};

export function CellLongText({
  value,
  isEditing,
  onCommit,
  onValueChange,
  onCancel,
  onTabNavigate,
}: CellLongTextProps) {
  const [draft, setDraft] = useState(() => toText(value));
  const cancelledRef = useRef(false);
  const committedRef = useRef(false);
  const wasEditingRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Seed draft and focus on the false->true editing transition only; ignore
  // value changes mid-edit so the user's typing is not clobbered.
  useEffect(() => {
    if (isEditing && !wasEditingRef.current) {
      cancelledRef.current = false;
      committedRef.current = false;
      setDraft(toText(value));
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      });
    }
    wasEditingRef.current = isEditing;
  }, [isEditing, value]);

  // Autosave after a typing pause; commit/cancel clear the pending fire so
  // a closed editor can never write a stale or discarded draft.
  const debouncedAutosave = useDebouncedCallback(() => {
    onValueChange(normalize(draft));
  }, 10_000);

  const commit = () => {
    if (committedRef.current) return;
    committedRef.current = true;
    debouncedAutosave.cancel();
    onCommit(normalize(draft));
  };
  const cancel = () => {
    cancelledRef.current = true;
    debouncedAutosave.cancel();
    onCancel();
  };

  const preview = formatLongTextPreview(toText(value));

  return (
    <Popover
      opened={isEditing}
      onChange={(opened) => {
        if (opened) return;
        // Programmatic close after cancel must not re-commit.
        if (cancelledRef.current) {
          cancelledRef.current = false;
          return;
        }
        commit();
      }}
      position="bottom-start"
      width={320}
      shadow="md"
      withinPortal
      closeOnClickOutside
      closeOnEscape={false}
      trapFocus
    >
      <Popover.Target>
        <div className={cellClasses.popoverTargetFlex}>
          {preview ? (
            <Tooltip label={toText(value)} multiline withinPortal openDelay={400} maw={420}>
              <span className={cellClasses.longTextPreview}>{preview}</span>
            </Tooltip>
          ) : (
            <span className={cellClasses.emptyValue} />
          )}
        </div>
      </Popover.Target>
      <Popover.Dropdown
        p={4}
        onClick={(e) => e.stopPropagation()}
        className={cellClasses.longTextDropdown}
      >
        {isEditing && (
          <>
            <Group justify="flex-end" mb={2}>
              <CloseButton size="sm" onClick={commit} aria-label="Close" />
            </Group>
            <Textarea
              ref={textareaRef}
              data-autofocus
              autosize
              minRows={3}
              maxRows={12}
              maxLength={25000}
              variant="unstyled"
              value={draft}
              onChange={(e) => {
                setDraft(e.currentTarget.value);
                debouncedAutosave();
              }}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Tab") {
                  e.preventDefault();
                  commit();
                  onTabNavigate?.(e.shiftKey);
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  cancel();
                } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  commit();
                }
              }}
              styles={{ input: { padding: 4 } }}
            />
          </>
        )}
      </Popover.Dropdown>
    </Popover>
  );
}
