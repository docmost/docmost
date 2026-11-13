import { useRef, useState } from "react";
import { Button, FileButton, Text } from "@mantine/core";
import { IconFileTypeCsv } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { getFileImportSizeLimit } from "@/lib/config.ts";
import { formatBytes } from "@/lib";
import classes from "@/ee/base/styles/csv-import.module.css";

type CsvImportDropzoneProps = {
  onFile: (file: File | null) => void;
};

export function CsvImportDropzone({ onFile }: CsvImportDropzoneProps) {
  const { t } = useTranslation();
  const [dragging, setDragging] = useState(false);
  const resetFileInput = useRef<() => void>(null);

  // an unchanged input fires no change event, so picking the same file again needs a reset
  const pickFile = (file: File | null) => {
    resetFileInput.current?.();
    onFile(file);
  };

  return (
    <div
      className={classes.dropzone}
      data-dragging={dragging || undefined}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        onFile(event.dataTransfer.files?.[0] ?? null);
      }}
    >
      <IconFileTypeCsv size={32} stroke={1.5} className={classes.dropIcon} />
      <FileButton
        resetRef={resetFileInput}
        onChange={pickFile}
        accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values"
      >
        {(props) => (
          <Button {...props} variant="default">
            {t("Choose CSV file")}
          </Button>
        )}
      </FileButton>
      <Text size="xs" c="dimmed">
        {t("Or drop a CSV file here. Up to {{limit}}.", {
          limit: formatBytes(getFileImportSizeLimit()),
        })}
      </Text>
    </div>
  );
}
