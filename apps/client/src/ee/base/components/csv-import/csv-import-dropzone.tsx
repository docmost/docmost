import { Fragment, useRef, useState } from "react";
import { Button, FileButton, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { getFileImportSizeLimit } from "@/lib/config.ts";
import { formatBytes } from "@/lib";
import classes from "@/ee/base/styles/csv-import.module.css";

type CsvImportDropzoneProps = {
  onFile: (file: File | null) => void;
};

const SHEET_LETTERS = ["A", "B", "C"];
const SHEET_BARS = [
  ["70%", "45%", "85%"],
  ["50%", "80%", "35%"],
];

function SheetIllustration() {
  return (
    <div className={classes.sheet} aria-hidden>
      <span className={`${classes.sheetCell} ${classes.sheetGutter}`} />
      {SHEET_LETTERS.map((letter) => (
        <span key={letter} className={`${classes.sheetCell} ${classes.sheetHead}`}>
          {letter}
        </span>
      ))}
      {SHEET_BARS.map((row, rowIndex) => (
        <Fragment key={rowIndex}>
          <span className={`${classes.sheetCell} ${classes.sheetGutter}`} />
          {row.map((width, cellIndex) => (
            <span key={cellIndex} className={classes.sheetCell}>
              <span className={classes.sheetBar} style={{ width }} />
            </span>
          ))}
        </Fragment>
      ))}
    </div>
  );
}

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
      <SheetIllustration />
      <Text className={classes.dropTitle}>{t("Drop a CSV file here")}</Text>
      <Text className={classes.dropHint}>
        {t("Up to {{limit}}. You'll check the columns before anything is imported.", {
          limit: formatBytes(getFileImportSizeLimit()),
        })}
      </Text>
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
    </div>
  );
}
