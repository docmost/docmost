import { Textarea, Text } from "@mantine/core";

type Props = {
  value: string;
  onChange: (v: string) => void;
  error?: { message: string; span?: { start: number; end: number } };
  resultType?: string;
};

export function FormulaInput({ value, onChange, error, resultType }: Props) {
  return (
    <div>
      <Textarea
        autosize
        minRows={3}
        maxRows={8}
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
        styles={{ input: { fontFamily: "ui-monospace, monospace", fontSize: 13 } }}
        placeholder='prop("Price") * prop("Qty")'
      />
      {error && (
        <Text size="xs" c="red.7" mt="xs">
          {error.message}
          {error.span ? ` (col ${error.span.start + 1})` : null}
        </Text>
      )}
      {!error && resultType && (
        <Text size="xs" c="dimmed" mt="xs">
          Returns: {resultType}
        </Text>
      )}
    </div>
  );
}
