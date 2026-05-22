import { FC } from "react";
import type { Editor } from "@tiptap/react";
import { ActionIcon, Tooltip } from "@mantine/core";
import { IconCheckbox, IconList, IconListNumbers } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import type { ToolbarState } from "../use-toolbar-state";
import classes from "../fixed-toolbar.module.css";

interface Props {
  editor: Editor;
  state: ToolbarState;
}

export const ListsGroup: FC<Props> = ({ editor, state }) => {
  const { t } = useTranslation();

  return (
    <ActionIcon.Group>
      <Tooltip label={t("Bullet List")} withArrow>
        <ActionIcon
          variant="subtle"
          color="dark"
          size="md"
          aria-label={t("Bullet List")}
          aria-pressed={state.isBulletList}
          className={clsx({ [classes.active]: state.isBulletList })}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <IconList size={16} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label={t("Numbered List")} withArrow>
        <ActionIcon
          variant="subtle"
          color="dark"
          size="md"
          aria-label={t("Numbered List")}
          aria-pressed={state.isOrderedList}
          className={clsx({ [classes.active]: state.isOrderedList })}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <IconListNumbers size={16} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label={t("To-do List")} withArrow>
        <ActionIcon
          variant="subtle"
          color="dark"
          size="md"
          aria-label={t("To-do List")}
          aria-pressed={state.isTaskList}
          className={clsx({ [classes.active]: state.isTaskList })}
          onClick={() => editor.chain().focus().toggleTaskList().run()}
        >
          <IconCheckbox size={16} />
        </ActionIcon>
      </Tooltip>
    </ActionIcon.Group>
  );
};
