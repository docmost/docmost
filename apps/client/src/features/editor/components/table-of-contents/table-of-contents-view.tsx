import { NodeViewContent, NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import {
    IconAlertTriangleFilled,
    IconCircleCheckFilled,
    IconCircleXFilled,
    IconInfoCircleFilled,
} from "@tabler/icons-react";
import { Alert, Divider, Group, Stack, Title, UnstyledButton, Text } from "@mantine/core";
// import classes from "./callout.module.css";
import { CalloutType } from "@docmost/editor-ext";
import React, { useMemo } from "react";
import { TextSelection } from "@tiptap/pm/state";
import classes from "./table-of-contents.module.css";
import clsx from "clsx";

export default function TableOfContentsView(props: NodeViewProps) {
    const { node, editor, selected } = props;
    const { type } = node.attrs;

    const headings = editor.getJSON().content?.filter((c) => c.type == "heading");

    return (
        <NodeViewWrapper>
            <Stack gap={0} className={clsx(selected ? "ProseMirror-selectednode" : "")} contentEditable={false}>
                {headings.map((value, index) => (
                    <UnstyledButton
                        key={`toc-${index}`}
                        className={classes.heading}
                        style={{
                            marginLeft: `calc(${value.attrs?.level} * var(--mantine-spacing-md))`,
                        }}
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (e.button != 0) return;

                            if (editor) {
                                const headings = editor.view.dom.querySelectorAll("h1, h2, h3, h4, h5, h6");
                                const clickedHeading = headings[index];

                                // find selected heading position in DOM relative to editors view
                                const pos = editor.view.posAtDOM(clickedHeading, 0);

                                // start new state transaction on editors view state
                                const tr = editor.view.state.tr;
                                // move editor cursor to heading
                                tr.setSelection(new TextSelection(tr.doc.resolve(pos)));
                                editor.view.dispatch(tr);
                                editor.view.focus();

                                window.scrollTo({
                                    top:
                                        clickedHeading.getBoundingClientRect().top -
                                        // subtract half of elements height to avoid viewport clipping
                                        clickedHeading.getBoundingClientRect().height / 2 -
                                        // substract headers height so that heading is visible after scroll.
                                        // getComputedStyles is not evaluating "--app-shell-header-height" so have hardcoded pixels.
                                        45 * 2 +
                                        window.scrollY,
                                    behavior: "smooth",
                                });
                            }
                        }}
                    >
                        <Group>
                            <Text m={6}>{value.content?.at(0).text}</Text>
                            <Divider className={classes.divider} />
                        </Group>
                    </UnstyledButton>
                ))}
            </Stack>
        </NodeViewWrapper>
    );
}
