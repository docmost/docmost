import {
  KeyboardEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import clsx from "clsx";
import classes from "@/ee/base/styles/form.module.css";

type FormInlineTextareaProps = {
  value: string;
  onCommit: (value: string) => void;
  className: string;
  ariaLabel: string;
  maxLength: number;
  placeholder?: string;
  singleLine?: boolean;
  autoFocus?: boolean;
  onAutoFocused?: () => void;
  onBlur?: (value: string) => void;
};

export function FormInlineTextarea({
  value,
  onCommit,
  className,
  ariaLabel,
  maxLength,
  placeholder,
  singleLine,
  autoFocus,
  onAutoFocused,
  onBlur,
}: FormInlineTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState(value);
  const focusedRef = useRef(false);
  const cancelRef = useRef(false);

  useEffect(() => {
    if (!focusedRef.current) setDraft(value);
  }, [value]);

  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useLayoutEffect(resize, [draft, resize]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let width = el.offsetWidth;
    const observer = new ResizeObserver(() => {
      if (el.offsetWidth === width) return;
      width = el.offsetWidth;
      resize();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [resize]);

  useEffect(() => {
    if (!autoFocus) return;
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.select();
    onAutoFocused?.();
  }, [autoFocus, onAutoFocused]);

  const handleBlur = () => {
    focusedRef.current = false;
    if (cancelRef.current) {
      cancelRef.current = false;
      setDraft(value);
      onBlur?.(value);
      return;
    }
    const next = draft.trim();
    setDraft(next);
    if (next !== value) onCommit(next);
    onBlur?.(next);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      cancelRef.current = true;
      event.currentTarget.blur();
    } else if (
      event.key === "Enter" &&
      !event.nativeEvent.isComposing &&
      (singleLine || event.metaKey || event.ctrlKey)
    ) {
      event.preventDefault();
      event.currentTarget.blur();
    }
  };

  return (
    <textarea
      ref={ref}
      rows={1}
      className={clsx(classes.inlineField, className)}
      aria-label={ariaLabel}
      placeholder={placeholder}
      maxLength={maxLength}
      value={draft}
      onFocus={() => {
        focusedRef.current = true;
      }}
      onChange={(event) =>
        setDraft(
          singleLine
            ? event.currentTarget.value.replace(/\s*\n\s*/g, " ")
            : event.currentTarget.value,
        )
      }
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    />
  );
}
