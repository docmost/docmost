import { Button } from "@mantine/core";
import { useAtomValue } from "jotai";
import { useTranslation } from "react-i18next";
import { IconCheck, IconCopy } from "@tabler/icons-react";
import { htmlToMarkdown } from "@docmost/editor-ext";
import { readOnlyEditorAtom } from "@/features/editor/atoms/editor-atoms.ts";
import { useDocsCurrentPage } from "@/features/public-space/hooks/use-docs-current-page.ts";
import { useClipboard } from "@/hooks/use-clipboard";
import styles from "./docs.module.css";

export default function DocsCopyPage() {
  const { t } = useTranslation();
  const editor = useAtomValue(readOnlyEditorAtom);
  const page = useDocsCurrentPage();
  const clipboard = useClipboard();

  if (!editor) {
    return null;
  }

  const handleCopy = () => {
    if (editor.isDestroyed) return;
    const markdown = htmlToMarkdown(editor.getHTML());
    const title = page?.name ? `# ${page.name}\n\n` : "";
    clipboard.copy(`${title}${markdown}`);
  };

  return (
    <Button
      variant="default"
      size="compact-sm"
      className={styles.copyPageButton}
      onClick={handleCopy}
      leftSection={
        clipboard.copied ? (
          <IconCheck size={14} stroke={1.8} />
        ) : (
          <IconCopy size={14} stroke={1.8} />
        )
      }
    >
      {clipboard.copied ? t("Copied") : t("Copy page")}
    </Button>
  );
}
