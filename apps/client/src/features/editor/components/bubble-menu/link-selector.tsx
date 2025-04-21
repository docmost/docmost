import { Dispatch, FC, SetStateAction, useCallback } from "react";
import { IconLink } from "@tabler/icons-react";
import { ActionIcon, Popover, Tooltip } from "@mantine/core";
import { useEditor } from "@tiptap/react";
import { LinkEditorPanel } from "@/features/editor/components/link/link-editor-panel.tsx";
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
    (url: string) => {
      setIsOpen(false);
      editor.chain().focus().setLink({ href: url }).run();
    },
    [editor, setIsOpen],
  );

  return (
    <Popover
      width={300}
      opened={isOpen}
      trapFocus
      offset={{ mainAxis: 35, crossAxis: 0 }}
      withArrow
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

      <Popover.Dropdown>
        <LinkEditorPanel onSetLink={onLink} />
      </Popover.Dropdown>
    </Popover>
  );
};
