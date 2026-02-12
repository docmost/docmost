import { Loader, Paper, ScrollArea } from "@mantine/core";
import DOMPurify from "dompurify";
import { marked } from "marked";
import { memo } from "react";
import classes from "./ai-menu.module.css";

interface ResultPreviewProps {
  output: string;
  isLoading: boolean;
}
const ResultPreview = memo(({ output, isLoading }: ResultPreviewProps) => {
  if (!output && !isLoading) return;

  const parsedOutput = `${marked.parse(output)}`;

  return (
    <Paper mb={4} shadow="lg" radius="md" className={classes.resultPreview}>
      <ScrollArea.Autosize mah={300} type="scroll" scrollbarSize={5}>
        <div className={classes.resultPreviewWrapper}>
          {parsedOutput && (
            <div
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(parsedOutput) }}
            />
          )}
          {isLoading && <Loader size={12} ml="xs" display="inline-block" />}
        </div>
      </ScrollArea.Autosize>
    </Paper>
  );
});

export { ResultPreview };
