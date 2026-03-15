import { Dispatch, FC, SetStateAction, useCallback } from "react";
import { IconLink } from "@tabler/icons-react";
import { ActionIcon, Popover, Tooltip } from "@mantine/core";
import { useEditor } from "@tiptap/react";
import { TextSelection } from "@tiptap/pm/state";
import { LinkEditorPanel } from "@/features/editor/components/link/link-editor-panel.tsx";
import { normalizeUrl } from "@/features/editor/components/link/link-view";
import { useTranslation } from "react-i18next";

interface LinkSelectorProps {
  editor: ReturnType<typeof useEditor>;
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
}

export const LinkSelector: FC<LinkSelectorProps> = ({
  editor,
  isOpen,
  setIsOpen,
}) => {
  const { t } = useTranslation();
  const onLink = useCallback(
    (url: string, internal?: boolean) => {
      setIsOpen(false);
      editor
        .chain()
        .focus()
        .setLink({ href: internal ? url : normalizeUrl(url), internal: !!internal } as any)
        .command(({ tr }) => {
          tr.setSelection(TextSelection.create(tr.doc, tr.selection.to));
          return true;
        })
        .run();
    },
    [editor, setIsOpen],
  );

  return (
    <Popover
      width={320}
      opened={isOpen}
      trapFocus
      offset={{ mainAxis: 35, crossAxis: 0 }}
      withArrow
      shadow="md"
    >
      <Popover.Target>
        <Tooltip label={t("Add link")} withArrow>
          <ActionIcon
            variant="default"
            size="lg"
            radius="0"
            style={{
              border: "none",
            }}
            onClick={() => setIsOpen(!isOpen)}
          >
            <IconLink size={16} />
          </ActionIcon>
        </Tooltip>
      </Popover.Target>

      <Popover.Dropdown p="sm">
        <LinkEditorPanel onSetLink={onLink} />
      </Popover.Dropdown>
    </Popover>
  );
};
