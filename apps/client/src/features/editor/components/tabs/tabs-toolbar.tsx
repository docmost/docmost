import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { ActionIcon, Tooltip } from "@mantine/core";
import { IconCheck, IconCopy, IconTrash } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import type { NodeViewProps } from "@tiptap/react";
import { copyNodeToClipboard } from "@/features/editor/utils";
import classes from "../common/toolbar-menu.module.css";

type TabsToolbarProps = Pick<NodeViewProps, "editor" | "getPos">;

export default function TabsToolbar({ editor, getPos }: TabsToolbarProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(copiedTimerRef.current), []);

  const handleCopy = () => {
    const pos = getPos();
    const node = typeof pos === "number" ? editor.state.doc.nodeAt(pos) : null;
    if (!node) return;

    copyNodeToClipboard(editor, node).then(() => {
      clearTimeout(copiedTimerRef.current);
      setCopied(true);
      copiedTimerRef.current = setTimeout(() => setCopied(false), 1500);
    });
  };

  const handleDelete = () => {
    const pos = getPos();
    if (typeof pos !== "number") return;
    editor.chain().focus().setNodeSelection(pos).deleteSelection().run();
  };

  return (
    <div
      className={clsx(classes.toolbar, "dm-tabs__toolbar")}
      contentEditable={false}
      onMouseDown={(e) => e.preventDefault()}
    >
      <Tooltip label={copied ? t("Copied") : t("Copy")}>
        <ActionIcon
          variant="subtle"
          size="lg"
          aria-label={t("Copy")}
          onClick={handleCopy}
        >
          {copied ? (
            <IconCheck size={18} color="var(--mantine-color-green-6)" />
          ) : (
            <IconCopy size={18} />
          )}
        </ActionIcon>
      </Tooltip>
      <Tooltip label={t("Delete")}>
        <ActionIcon
          variant="subtle"
          size="lg"
          aria-label={t("Delete")}
          onClick={handleDelete}
        >
          <IconTrash size={18} />
        </ActionIcon>
      </Tooltip>
    </div>
  );
}
