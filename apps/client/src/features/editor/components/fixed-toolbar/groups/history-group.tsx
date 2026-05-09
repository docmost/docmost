import { FC } from "react";
import type { Editor } from "@tiptap/react";
import { ActionIcon, Tooltip } from "@mantine/core";
import { IconArrowBackUp, IconArrowForwardUp } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import type { ToolbarState } from "../use-toolbar-state";

interface Props {
  editor: Editor;
  state: ToolbarState;
}

export const HistoryGroup: FC<Props> = ({ editor, state }) => {
  const { t } = useTranslation();

  return (
    <ActionIcon.Group>
      <Tooltip label={t("Undo")} withArrow>
        <ActionIcon
          variant="subtle"
          color="dark"
          size="md"
          aria-label={t("Undo")}
          disabled={!state.canUndo}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <IconArrowBackUp size={16} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label={t("Redo")} withArrow>
        <ActionIcon
          variant="subtle"
          color="dark"
          size="md"
          aria-label={t("Redo")}
          disabled={!state.canRedo}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <IconArrowForwardUp size={16} />
        </ActionIcon>
      </Tooltip>
    </ActionIcon.Group>
  );
};
