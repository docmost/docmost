import { BubbleMenu as BaseBubbleMenu, findParentNode, posToDOMRect } from "@tiptap/react";
import React, { useCallback } from "react";
import { sticky } from "tippy.js";
import { Node as PMNode } from "prosemirror-model";
import { EditorMenuProps, ShouldShowProps } from "@/features/editor/components/table/types/types.ts";
import {
    ActionIcon,
    DividerVariant,
    Group,
    SegmentedControl,
    Select,
    Tooltip,
    Text,
    Checkbox,
    Card,
    Fieldset,
} from "@mantine/core";
import { IconLayoutAlignCenter, IconLayoutAlignLeft, IconLayoutAlignRight } from "@tabler/icons-react";
import { NodeWidthResize } from "@/features/editor/components/common/node-width-resize.tsx";

export function TableOfContentsMenu({ editor }: EditorMenuProps) {
    const shouldShow = useCallback(
        ({ state }: ShouldShowProps) => {
            if (!state) {
                return false;
            }

            return editor.isActive("tableOfContents");
        },
        [editor]
    );

    const getReferenceClientRect = useCallback(() => {
        const { selection } = editor.state;
        const predicate = (node: PMNode) => node.type.name === "tableOfContents";
        const parent = findParentNode(predicate)(selection);

        if (parent) {
            const dom = editor.view.nodeDOM(parent?.pos) as HTMLElement;
            return dom.getBoundingClientRect();
        }

        return posToDOMRect(editor.view, selection.from, selection.to);
    }, [editor]);

    const setDividerType = useCallback(
        (type: DividerVariant) => {
            editor.chain().focus(undefined, { scrollIntoView: false }).setDividerType(type).run();
        },
        [editor]
    );

    const setTableType = useCallback(
        (type: "Contents" | "Child Pages") => {
            editor.chain().focus(undefined, { scrollIntoView: false }).setTableType(type).run();
        },
        [editor]
    );

    const setPageIcons = useCallback(
        (icons: boolean) => {
            editor.chain().focus(undefined, { scrollIntoView: false }).setPageIcons(icons).run();
        },
        [editor]
    );

    return (
        <BaseBubbleMenu
            editor={editor}
            pluginKey={`tableOfContents-menu}`}
            updateDelay={0}
            tippyOptions={{
                getReferenceClientRect,
                offset: [0, 8],
                zIndex: 99,
                popperOptions: {
                    modifiers: [{ name: "flip", enabled: false }],
                },
                plugins: [sticky],
                sticky: "popper",
                maxWidth: 500,
            }}
            shouldShow={shouldShow}
        >
            <Fieldset variant="filled" p="xs">
                <Group gap="xs">
                    <Tooltip position="top" label="Divider type">
                        <Select
                            w={100}
                            value={editor.getAttributes("tableOfContents").dividerType}
                            data={[
                                { value: "solid", label: "Solid" },
                                { value: "dashed", label: "Dashed" },
                                { value: "dotted", label: "Dotted" },
                                { value: "none", label: "None" },
                            ]}
                            onChange={(_value, option) => setDividerType(_value as DividerVariant)}
                        />
                    </Tooltip>
                    <Tooltip position="top" label="Table type">
                        <SegmentedControl
                            value={editor.getAttributes("tableOfContents").tableType}
                            data={["Contents", "Child Pages"]}
                            onChange={(value: "Contents" | "Child Pages") => setTableType(value)}
                        />
                    </Tooltip>
                    {editor.getAttributes("tableOfContents").tableType == "Child Pages" && (
                        <Tooltip position="top" label="Show page icons">
                            <Group gap="xs">
                                <Text size="sm">Page Icons</Text>
                                <Checkbox
                                    checked={editor.getAttributes("tableOfContents").icons}
                                    onChange={(event) => setPageIcons(event.currentTarget.checked)}
                                />
                            </Group>
                        </Tooltip>
                    )}
                </Group>
            </Fieldset>
        </BaseBubbleMenu>
    );
}

export default TableOfContentsMenu;
