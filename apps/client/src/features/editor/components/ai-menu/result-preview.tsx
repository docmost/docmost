import { Loader, Paper, Text } from "@mantine/core";
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
    <Paper p="sm" mb={4} withBorder>
      <Text size="sm">
        {parsedOutput && (
          <div
            className={classes.resultPreviewWrapper}
            dangerouslySetInnerHTML={{ __html: parsedOutput }}
          />
        )}
        {isLoading && <Loader size={12} ml="xs" display="inline-block" />}
      </Text>
    </Paper>
  );
});

export { ResultPreview };
