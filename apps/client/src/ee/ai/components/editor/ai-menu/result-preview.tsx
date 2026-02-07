import { Loader, Paper, Text } from "@mantine/core";
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
    <Paper p="md" mb={4} shadow="md" radius="md" className={classes.resultPreview}>
      <div className={classes.resultPreviewWrapper}>
        {parsedOutput && (
          <div
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(parsedOutput) }}
          />
        )}
        {isLoading && <Loader size={12} ml="xs" display="inline-block" />}
      </div>
    </Paper>
  );
});

export { ResultPreview };
