import { forwardRef } from "react";
import { Textarea } from "@mantine/core";

type Props = {
  value: string;
  onChange: (v: string) => void;
  hasError?: boolean;
};

export const FormulaInput = forwardRef<HTMLTextAreaElement, Props>(
  function FormulaInput({ value, onChange, hasError }, ref) {
    return (
      <Textarea
        ref={ref}
        autosize
        minRows={3}
        maxRows={8}
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
        placeholder='prop("Price") * prop("Qty")'
        styles={{
          input: {
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, 'JetBrains Mono', monospace",
            fontSize: 13,
            lineHeight: 1.65,
            backgroundColor: "var(--mantine-color-gray-0)",
            borderColor: hasError
              ? "var(--mantine-color-red-6)"
              : "var(--mantine-color-blue-6)",
            borderWidth: 1.5,
            boxShadow: hasError
              ? "0 0 0 3px var(--mantine-color-red-1)"
              : "0 0 0 3px var(--mantine-color-blue-1)",
          },
        }}
      />
    );
  },
);
