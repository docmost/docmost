import { useEffect, useState } from "react";
import { TextInput } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { IBaseProperty, IBaseRow } from "@/features/base/types/base.types";

type RowDetailTitleProps = {
  row: IBaseRow;
  primaryProperty: IBaseProperty | undefined;
  onCommit: (value: string) => void;
};

export function RowDetailTitle({
  row,
  primaryProperty,
  onCommit,
}: RowDetailTitleProps) {
  const { t } = useTranslation();
  const initial = primaryProperty
    ? (((row.cells ?? {})[primaryProperty.id] as string) ?? "")
    : "";
  const [value, setValue] = useState(initial);

  // Re-sync if the underlying row changes (e.g. another client updated it).
  useEffect(() => {
    setValue(initial);
  }, [initial]);

  return (
    <TextInput
      autoFocus
      placeholder={t("Untitled")}
      value={value}
      variant="unstyled"
      size="xl"
      onChange={(e) => setValue(e.currentTarget.value)}
      onBlur={() => {
        if (value !== initial) onCommit(value);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.currentTarget as HTMLInputElement).blur();
        }
      }}
    />
  );
}
