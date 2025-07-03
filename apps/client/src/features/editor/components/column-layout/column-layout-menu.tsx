import {
  BubbleMenu as BaseBubbleMenu,
  findParentNode,
  posToDOMRect,
} from "@tiptap/react";
import React, { useCallback, useState } from "react";
import { Node as PMNode } from "prosemirror-model";
import {
  EditorMenuProps,
  ShouldShowProps,
} from "@/features/editor/components/table/types/types.ts";
import {
  ActionIcon,
  Button,
  Popover,
  Slider,
  Stack,
  Tooltip,
  Text,
} from "@mantine/core";
import {
  IconColumnInsertLeft,
  IconColumnInsertRight,
  IconColumnRemove,
  IconSettings,
  IconTrashX,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { SliderItem } from "./slider-item";

export const ColumnLayoutMenu = React.memo(
  ({ editor, appendTo }: EditorMenuProps): JSX.Element => {
    const { t } = useTranslation();
    const shouldShow = useCallback(
      ({ state }: ShouldShowProps) => {
        if (!state) {
          return false;
        }

        return editor.isActive("column");
      },
      [editor]
    );

    const [popoverOpened, setPopoverOpened] = useState(false);
    const [tmpXsAttr, setTmpXsAttr] = useState<number>();
    const [tmpMdAttr, setTmpMdAttr] = useState<number>();
    const [tmpLgAttr, setTmpLgAttr] = useState<number>();

    const addColumnBefore = useCallback(() => {
      editor.chain().focus().clAddColumnBefore().run();
    }, [editor]);

    const addColumnAfter = useCallback(() => {
      editor.chain().focus().clAddColumnAfter().run();
    }, [editor]);

    const deleteColumn = useCallback(() => {
      editor.chain().focus().clDeleteColumn().run();
    }, [editor]);

    const deleteColumnLayout = useCallback(() => {
      editor.chain().focus().clDeleteColumnLayout().run();
    }, [editor]);

    const setAttr = useCallback(() => {
      editor.commands.clSetColumnAttr(tmpXsAttr, tmpMdAttr, tmpLgAttr);

      setPopoverOpened(false);
    }, [editor, tmpXsAttr, tmpMdAttr, tmpLgAttr]);

    const getAttrAndOpenSettings = () => {
      const attr = editor.commands.clGetColumnAttr();

      setTmpXsAttr(attr["xs"]);
      setTmpMdAttr(attr["md"]);
      setTmpLgAttr(attr["lg"]);

      setPopoverOpened(true);
    };

    const getReferenceClientRect = useCallback(() => {
      const { selection } = editor.state;
      const predicate = (node: PMNode) => node.type.name === "column";
      const parent = findParentNode(predicate)(selection);

      if (parent) {
        const dom = editor.view.nodeDOM(parent?.pos) as HTMLElement;
        return dom.getBoundingClientRect();
      }

      return posToDOMRect(editor.view, selection.from, selection.to);
    }, [editor]);

    return (
      <BaseBubbleMenu
        editor={editor}
        pluginKey="column-layout-menu"
        updateDelay={0}
        tippyOptions={{
          getReferenceClientRect,
          placement: "top",
          zIndex: 99,
          popperOptions: {
            modifiers: [{ name: "flip", enabled: false }],
          },
        }}
        shouldShow={shouldShow}
      >
        <ActionIcon.Group>
          <Tooltip position="top" label={t("Add column before")}>
            <ActionIcon
              onClick={addColumnBefore}
              variant="default"
              size="lg"
              aria-label={t("Add column before")}
            >
              <IconColumnInsertLeft size={18} />
            </ActionIcon>
          </Tooltip>
          <Tooltip position="top" label={t("Add column after")}>
            <ActionIcon
              onClick={addColumnAfter}
              variant="default"
              size="lg"
              aria-label={t("Add column after")}
            >
              <IconColumnInsertRight size={18} />
            </ActionIcon>
          </Tooltip>
          <Tooltip
            position="top"
            label={t("Delete column")}
            withinPortal={false}
          >
            <ActionIcon
              onClick={deleteColumn}
              variant="default"
              size="lg"
              color="red"
              aria-label={t("Delete column")}
            >
              <IconColumnRemove size={18} />
            </ActionIcon>
          </Tooltip>
          <Tooltip
            position="top"
            label={t("Delete column layout")}
            withinPortal={false}
          >
            <ActionIcon
              onClick={deleteColumnLayout}
              variant="default"
              size="lg"
              color="red"
              aria-label={t("Delete column layout")}
            >
              <IconTrashX size={18} />
            </ActionIcon>
          </Tooltip>

          <Popover
            width={200}
            position="bottom"
            withArrow
            shadow="md"
            opened={popoverOpened}
            onDismiss={() => setPopoverOpened(false)}
          >
            <Popover.Target>
              <Tooltip position="top" label={t("Settings")}>
                <ActionIcon
                  onClick={() => getAttrAndOpenSettings()}
                  variant="default"
                  size="lg"
                  color="red"
                  aria-label={t("Settings")}
                >
                  <IconSettings size={18} />
                </ActionIcon>
              </Tooltip>
            </Popover.Target>
            <Popover.Dropdown>
              <Stack
                align="stretch"
                justify="center"
                gap="xs"
              >
                <SliderItem
                  label="XS"
                  value={tmpXsAttr}
                  onChange={setTmpXsAttr}
                />
                <SliderItem
                  label="MD"
                  value={tmpMdAttr}
                  onChange={setTmpMdAttr}
                />
                <SliderItem
                  label="LG"
                  value={tmpLgAttr}
                  onChange={setTmpLgAttr}
                />

                <Button onClick={() => setAttr()}>{t("Save")}</Button>
              </Stack>
            </Popover.Dropdown>
          </Popover>
        </ActionIcon.Group>
      </BaseBubbleMenu>
    );
  }
);

export default ColumnLayoutMenu;
