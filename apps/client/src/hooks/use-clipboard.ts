// Source: https://github.com/mantinedev/mantine/blob/master/packages/@mantine/hooks/src/use-clipboard/use-clipboard.ts
// polyfilled to support execCommand fallback
import { useState } from "react";

export type UseClipboardOptions = {
  timeout?: number;
};

export type UseClipboardReturnValue = {
  copy: (value: string) => void;
  reset: () => void;
  error: Error | null;
  copied: boolean;
};

export function useClipboard(
  options: UseClipboardOptions = { timeout: 2000 },
): UseClipboardReturnValue {
  const [error, setError] = useState<Error | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyTimeout, setCopyTimeout] = useState<number | null>(null);

  const handleCopyResult = (value: boolean) => {
    window.clearTimeout(copyTimeout!);
    setCopyTimeout(window.setTimeout(() => setCopied(false), options.timeout));
    setCopied(value);
  };

  const copy = (value: string) => {
    if ("clipboard" in navigator) {
      navigator.clipboard
        .writeText(value)
        .then(() => handleCopyResult(true))
        .catch(() => {
          try {
            fallbackCopy(value);
            handleCopyResult(true);
          } catch (err) {
            setError(err instanceof Error ? err : new Error("Failed to copy"));
          }
        });
    } else {
      try {
        fallbackCopy(value);
        handleCopyResult(true);
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Failed to copy"));
      }
    }
  };

  const reset = () => {
    setCopied(false);
    setError(null);
    window.clearTimeout(copyTimeout!);
  };

  return { copy, reset, error, copied };
}

function fallbackCopy(value: string): void {
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}
