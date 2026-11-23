import { FC } from "react";
import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import { Button, Menu } from "@mantine/core";
import {
  IconBlockquote,
  IconBraces,
  IconChevronDown,
  IconH1,
  IconH2,
  IconH3,
  IconMenu4,
  IconPageBreak,
  IconTypography,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import classes from "../fixed-toolbar.module.css";

const blockLabels = [
  "Normal text",
  "Heading 1",
  "Heading 2",
  "Heading 3",
  "Quote",
  "Code block",
] as const;

interface Props {
  editor: Editor | null;
}

export const BlockTypeGroup: FC<Props> = ({ editor }) => {
  const { t } = useTranslation();

  const state = useEditorState({
    editor,
    selector: (ctx) => ({
      isHeading1: !!ctx.editor?.isActive("heading", { level: 1 }),
      isHeading2: !!ctx.editor?.isActive("heading", { level: 2 }),
      isHeading3: !!ctx.editor?.isActive("heading", { level: 3 }),
      isBlockquote: !!ctx.editor?.isActive("blockquote"),
      isCodeBlock: !!ctx.editor?.isActive("codeBlock"),
    }),
  });

  let label: (typeof blockLabels)[number] = "Normal text";
  if (state?.isHeading1) label = "Heading 1";
  else if (state?.isHeading2) label = "Heading 2";
  else if (state?.isHeading3) label = "Heading 3";
  else if (state?.isBlockquote) label = "Quote";
  else if (state?.isCodeBlock) label = "Code block";

  const trigger = (
    <Button
      variant="subtle"
      color="dark"
      size="xs"
      rightSection={<IconChevronDown size={14} />}
    >
      <span className={classes.blockTypeLabel}>
        {blockLabels.map((option) => (
          <span key={option} aria-hidden={option !== label || undefined}>
            {t(option)}
          </span>
        ))}
      </span>
    </Button>
  );
  if (!editor) return trigger;

  return (
    <Menu shadow="md" position="bottom-start" withArrow={false}>
      <Menu.Target>{trigger}</Menu.Target>
      <Menu.Dropdown>
        <Menu.Item
          leftSection={<IconTypography size={16} />}
          onClick={() =>
            editor.chain().focus().toggleNode("paragraph", "paragraph").run()
          }
        >
          {t("Text")}
        </Menu.Item>
        <Menu.Item
          leftSection={<IconH1 size={16} />}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
        >
          {t("Heading 1")}
        </Menu.Item>
        <Menu.Item
          leftSection={<IconH2 size={16} />}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
        >
          {t("Heading 2")}
        </Menu.Item>
        <Menu.Item
          leftSection={<IconH3 size={16} />}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
        >
          {t("Heading 3")}
        </Menu.Item>
        <Menu.Item
          leftSection={<IconBlockquote size={16} />}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          {t("Quote")}
        </Menu.Item>
        <Menu.Item
          leftSection={<IconBraces size={16} />}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        >
          {t("Code block")}
        </Menu.Item>
        <Menu.Item
          leftSection={<IconMenu4 size={16} />}
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        >
          {t("Divider")}
        </Menu.Item>
        <Menu.Item
          leftSection={<IconPageBreak size={16} />}
          onClick={() => editor.chain().focus().setPageBreak().run()}
        >
          {t("Page break")}
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
};
