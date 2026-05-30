import React from "react";
import type { Editor } from "@tiptap/react";
import { Menu } from "@mantine/core";
import {
  IconAlignCenter,
  IconAlignLeft,
  IconAlignRight,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

interface AlignmentSubmenuProps {
  editor: Editor;
}

export const AlignmentSubmenu = React.memo(function AlignmentSubmenu({
  editor,
}: AlignmentSubmenuProps) {
  const { t } = useTranslation();

  return (
    <Menu.Sub position="right-start">
      <Menu.Sub.Target>
        <Menu.Sub.Item leftSection={<IconAlignLeft size={16} />}>
          {t("Text alignment")}
        </Menu.Sub.Item>
      </Menu.Sub.Target>
      <Menu.Sub.Dropdown>
        <Menu.Item
          leftSection={<IconAlignLeft size={16} />}
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
        >
          {t("Align left")}
        </Menu.Item>
        <Menu.Item
          leftSection={<IconAlignCenter size={16} />}
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
        >
          {t("Align center")}
        </Menu.Item>
        <Menu.Item
          leftSection={<IconAlignRight size={16} />}
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
        >
          {t("Align right")}
        </Menu.Item>
      </Menu.Sub.Dropdown>
    </Menu.Sub>
  );
});
