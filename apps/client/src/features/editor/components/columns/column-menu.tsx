import {
  BubbleMenu as BaseBubbleMenu,
  posToDOMRect,
  findParentNode,
  isNodeSelection,
  useEditorState,
} from "@tiptap/react";
import { useCallback } from "react";
import {
  ActionIcon,
  Tooltip,
  Menu,
  Button,
  Group,
  Divider,
} from "@mantine/core";
import {
  IconColumns,
  IconLayoutColumns,
  IconColumns3,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarRightCollapse,
  IconTrash,
  IconChevronDown,
  IconRectangle,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { Editor } from "@tiptap/core";

export interface ColumnMenuProps {
  editor: Editor;
}

export const ColumnMenu = ({ editor }: ColumnMenuProps): JSX.Element => {
  const { t } = useTranslation();

  const editorState = useEditorState({
    editor,
    selector: (ctx) => {
      const { selection } = ctx.editor.state;
      const result = findParentNode((node) => node.type.name === "columnGroup")(
        selection,
      );

      let count = result?.node?.childCount || 0;

      // Robust fallback: if findParentNode fails but we are active
      if (!result && ctx.editor.isActive("columnGroup")) {
        const { $from } = selection;
        for (let i = $from.depth; i > 0; i--) {
          const node = $from.node(i);
          if (node.type.name === "columnGroup") {
            count = node.childCount;
            break;
          }
        }
      }

      return {
        columnGroup: result,
        columnCount: count,
      };
    },
  });

  const columnGroup = editorState?.columnGroup;
  const columnCount = editorState?.columnCount || 0;

  const shouldShow = useCallback(
    ({ editor }: { editor: Editor }) => {
      const { selection } = editor.state;

      // Skip if selection is a node selection of image, video, or table
      if (isNodeSelection(selection)) {
        const nodeType = (selection as any).node.type.name;
        if (["image", "video", "customTable", "table"].includes(nodeType)) {
          return false;
        }
      }

      // Skip if we are explicitly in an image or video (even if not node selection)
      if (
        editor.isActive("image") ||
        editor.isActive("video") ||
        editor.isActive("customTable") ||
        editor.isActive("table")
      ) {
        return false;
      }

      return editor.isActive("columnGroup");
    },
    [editor],
  );

  const getReferenceClientRect = useCallback(() => {
    if (columnGroup) {
      const dom = editor.view.nodeDOM(columnGroup.pos) as HTMLElement;
      if (dom) {
        return dom.getBoundingClientRect();
      }
    }

    return posToDOMRect(
      editor.view,
      editor.state.selection.from,
      editor.state.selection.to,
    );
  }, [editor, columnGroup]);

  const setLayout = (widths: number[]) => {
    editor.chain().focus().updateColumnLayout(widths).run();
  };

  const setColumnCount = (count: number) => {
    editor.chain().focus().setColumnCount(count).run();
  };

  const deleteColumnGroup = () => {
    editor.chain().focus().deleteColumnGroup().run();
  };

  return (
    <BaseBubbleMenu
      editor={editor}
      pluginKey="column-menu"
      updateDelay={0}
      tippyOptions={{
        getReferenceClientRect: getReferenceClientRect,
        offset: [0, 15],
        zIndex: 101,
        popperOptions: {
          modifiers: [
            {
              name: "preventOverflow",
              enabled: true,
              options: {
                altAxis: true,
                boundary: "clippingParents",
                padding: 8,
              },
            },
            {
              name: "flip",
              enabled: true,
              options: {
                boundary: editor.options.element,
                fallbackPlacements: ["top", "bottom"],
                padding: { top: 35, left: 8, right: 8, bottom: -Infinity },
              },
            },
          ],
        },
      }}
      shouldShow={shouldShow}
    >
      <ActionIcon.Group
        style={{
          backgroundColor: "var(--mantine-color-body)",
          border: "1px solid var(--mantine-color-default-border)",
          borderRadius: "4px",
          overflow: "hidden",
          boxShadow: "var(--mantine-shadow-md)",
        }}
      >
        <Menu shadow="md" width={150} zIndex={1001}>
          <Menu.Target>
            <Button
              variant="subtle"
              color="blue"
              rightSection={<IconChevronDown size={14} />}
              size="sm"
              styles={{
                root: {
                  borderRight: "1px solid var(--mantine-color-default-border)",
                  borderRadius: 0,
                  height: "34px",
                },
              }}
            >
              {t("{{count}} Column{{many}}", {
                count: columnCount,
                many: columnCount === 1 ? "" : "s",
              })}
            </Button>
          </Menu.Target>

          <Menu.Dropdown>
            <Menu.Item
              leftSection={<IconRectangle size={16} />}
              onClick={() => setColumnCount(1)}
            >
              {t("1 Column")}
            </Menu.Item>
            <Menu.Item
              leftSection={<IconLayoutColumns size={16} />}
              onClick={() => setColumnCount(2)}
            >
              {t("2 Columns")}
            </Menu.Item>
            <Menu.Item
              leftSection={<IconColumns size={16} />}
              onClick={() => setColumnCount(3)}
            >
              {t("3 Columns")}
            </Menu.Item>
            <Menu.Item
              leftSection={<IconColumns size={16} />}
              onClick={() => setColumnCount(4)}
            >
              {t("4 Columns")}
            </Menu.Item>
            <Menu.Item
              leftSection={<IconColumns size={16} />}
              onClick={() => setColumnCount(5)}
            >
              {t("5 Columns")}
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>

        <Group gap={0}>
          {columnCount === 2 && (
            <>
              <Tooltip position="top" label={t("Left Sidebar (25/75)")}>
                <ActionIcon
                  onClick={() => setLayout([25, 75])}
                  variant="subtle"
                  color="gray"
                  size="lg"
                >
                  <IconLayoutSidebarLeftCollapse size={18} />
                </ActionIcon>
              </Tooltip>
              <Tooltip position="top" label={t("Equal (50/50)")}>
                <ActionIcon
                  onClick={() => setLayout([50, 50])}
                  variant="subtle"
                  color="gray"
                  size="lg"
                >
                  <IconLayoutColumns size={18} />
                </ActionIcon>
              </Tooltip>
              <Tooltip position="top" label={t("Right Sidebar (75/25)")}>
                <ActionIcon
                  onClick={() => setLayout([75, 25])}
                  variant="subtle"
                  color="gray"
                  size="lg"
                >
                  <IconLayoutSidebarRightCollapse size={18} />
                </ActionIcon>
              </Tooltip>
            </>
          )}

          {columnCount === 3 && (
            <>
              <Tooltip position="top" label={t("Main Left (50/25/25)")}>
                <ActionIcon
                  onClick={() => setLayout([50, 25, 25])}
                  variant="subtle"
                  color="gray"
                  size="lg"
                >
                  <IconLayoutSidebarLeftCollapse size={18} />
                </ActionIcon>
              </Tooltip>
              <Tooltip position="top" label={t("Center Focus (25/50/25)")}>
                <ActionIcon
                  onClick={() => setLayout([25, 50, 25])}
                  variant="subtle"
                  color="gray"
                  size="lg"
                >
                  <IconLayoutColumns size={18} />
                </ActionIcon>
              </Tooltip>
              <Tooltip position="top" label={t("Main Right (25/25/50)")}>
                <ActionIcon
                  onClick={() => setLayout([25, 25, 50])}
                  variant="subtle"
                  color="gray"
                  size="lg"
                >
                  <IconLayoutSidebarRightCollapse size={18} />
                </ActionIcon>
              </Tooltip>
              <Tooltip position="top" label={t("Equal (33/33/33)")}>
                <ActionIcon
                  onClick={() => setLayout([33, 33, 33])}
                  variant="subtle"
                  color="gray"
                  size="lg"
                >
                  <IconColumns3 size={18} />
                </ActionIcon>
              </Tooltip>
            </>
          )}

          <Divider orientation="vertical" />
          <ActionIcon
            onClick={deleteColumnGroup}
            variant="subtle"
            color="red"
            size="lg"
          >
            <IconTrash size={18} />
          </ActionIcon>
        </Group>
      </ActionIcon.Group>
    </BaseBubbleMenu>
  );
};

export default ColumnMenu;
