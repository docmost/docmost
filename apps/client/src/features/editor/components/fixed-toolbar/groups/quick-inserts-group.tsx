import { FC } from "react";
import type { Editor } from "@tiptap/react";
import { ActionIcon, Menu, Tooltip } from "@mantine/core";
import {
  IconAt,
  IconColumns2,
  IconColumns3,
  IconMoodSmile,
  IconTable,
} from "@tabler/icons-react";
import { IconColumns4 } from "@/components/icons/icon-columns-4";
import { IconColumns5 } from "@/components/icons/icon-columns-5";
import { useTranslation } from "react-i18next";

interface Props {
  editor: Editor;
}

export const QuickInsertsGroup: FC<Props> = ({ editor }) => {
  const { t } = useTranslation();

  return (
    <ActionIcon.Group>
      <Tooltip label={t("Mention")} withArrow>
        <ActionIcon
          variant="subtle"
          color="dark"
          size="md"
          aria-label={t("Mention")}
          onClick={() => editor.chain().focus().insertContent("@").run()}
        >
          <IconAt size={16} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label={t("Emoji")} withArrow>
        <ActionIcon
          variant="subtle"
          color="dark"
          size="md"
          aria-label={t("Emoji")}
          onClick={() => editor.chain().focus().insertContent(":").run()}
        >
          <IconMoodSmile size={16} />
        </ActionIcon>
      </Tooltip>
      <Menu shadow="md" position="bottom-start" withArrow={false}>
        <Menu.Target>
          <Tooltip label={t("Columns")} withArrow>
            <ActionIcon
              variant="subtle"
              color="dark"
              size="md"
              aria-label={t("Columns")}
            >
              <IconColumns2 size={16} />
            </ActionIcon>
          </Tooltip>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item
            leftSection={<IconColumns2 size={16} />}
            onClick={() =>
              editor.chain().focus().insertColumns({ layout: "two_equal" }).run()
            }
          >
            {t("{{count}} Columns", { count: 2 })}
          </Menu.Item>
          <Menu.Item
            leftSection={<IconColumns3 size={16} />}
            onClick={() =>
              editor
                .chain()
                .focus()
                .insertColumns({ layout: "three_equal" })
                .run()
            }
          >
            {t("{{count}} Columns", { count: 3 })}
          </Menu.Item>
          <Menu.Item
            leftSection={<IconColumns4 size={16} />}
            onClick={() =>
              editor.chain().focus().insertColumns({ layout: "four_equal" }).run()
            }
          >
            {t("{{count}} Columns", { count: 4 })}
          </Menu.Item>
          <Menu.Item
            leftSection={<IconColumns5 size={16} />}
            onClick={() =>
              editor.chain().focus().insertColumns({ layout: "five_equal" }).run()
            }
          >
            {t("{{count}} Columns", { count: 5 })}
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
      <Tooltip label={t("Table")} withArrow>
        <ActionIcon
          variant="subtle"
          color="dark"
          size="md"
          aria-label={t("Table")}
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
              .run()
          }
        >
          <IconTable size={16} />
        </ActionIcon>
      </Tooltip>
    </ActionIcon.Group>
  );
};
