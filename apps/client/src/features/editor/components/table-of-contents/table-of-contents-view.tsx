import { JSONContent, NodeViewContent, NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import {
    IconAlertTriangleFilled,
    IconCircleCheckFilled,
    IconCircleXFilled,
    IconInfoCircleFilled,
} from "@tabler/icons-react";
import { Alert, Divider, Group, Stack, Title, UnstyledButton, Text, DividerVariant } from "@mantine/core";
import { CalloutType } from "@docmost/editor-ext";
import React, { useEffect, useMemo, useState } from "react";
import { TextSelection } from "@tiptap/pm/state";
import classes from "./table-of-contents.module.css";
import clsx from "clsx";
import { useGetRootSidebarPagesQuery, usePageQuery } from "@/features/page/queries/page-query";
import { IPage, SidebarPagesParams } from "@/features/page/types/page.types";
import { queryClient } from "@/main";
import { getSidebarPages } from "@/features/page/services/page-service";
import { useToggle } from "@mantine/hooks";
import { useNavigate, useParams } from "react-router-dom";
import { buildPageUrl } from "@/features/page/page.utils";
import { string } from "zod";

export default function TableOfContentsView(props: NodeViewProps) {
    const { node, editor, selected } = props;

    const { dividerType, tableType, icons } = node.attrs as {
        dividerType: DividerVariant & "none";
        tableType: "Contents" | "Child Pages";
        icons: boolean;
    };

    const pageId = editor.storage?.pageId;

    const { data: page } = usePageQuery({
        pageId: pageId,
    });

    const { pageSlug, spaceSlug } = useParams();

    const navigate = useNavigate();

    const [childPages, setChildPages] = useState<JSX.Element[]>([]);
    const [headings, setHeadings] = useState<JSX.Element[]>([]);

    const fetchChildren = async (params: SidebarPagesParams) => {
        return await queryClient.fetchQuery({
            queryKey: ["toc-child-pages", params],
            queryFn: () => getSidebarPages(params),
            staleTime: 10 * 60 * 1000,
        });
    };

    // Max depth to prevent infinite recursion errors
    const MAX_RECURSION_DEPTH = 10;

    const fetchAllChildren = async (
        currentPage: IPage,
        pages: (IPage & { depth: number })[],
        depth: number = 0
    ): Promise<void> => {
        // Prevent infinite recursion
        if (depth > MAX_RECURSION_DEPTH) {
            console.warn("Max recursion depth reached");
            return;
        }

        const params: SidebarPagesParams = {
            pageId: currentPage.id,
            spaceId: currentPage.spaceId,
        };

        const result = await fetchChildren(params);
        const children = result.items;

        // Store the children in the relationships map
        for (let child of children) pages.push({ ...child, depth });

        // Use requestIdleCallback to allow the browser to perform other tasks
        for (const child of children) {
            if (child.hasChildren) {
                await new Promise((resolve) =>
                    requestIdleCallback(() => {
                        fetchAllChildren(child, pages, depth + 1).then(resolve);
                    })
                );
            }
        }
    };

    useEffect(() => {
        if (!page) return;

        (async () => {
            if (tableType == "Child Pages") {
                // Initialize the child pagse array
                const pages: (IPage & { depth: number })[] = [];

                // Fetch all children recursively
                await fetchAllChildren(page, pages);

                const tocChildPages: JSX.Element[] = pages.map((value, index) => (
                    <UnstyledButton
                        key={`toc-${index}`}
                        className={classes.heading}
                        style={{
                            marginLeft: `calc(${value.depth} * var(--mantine-spacing-md))`,
                        }}
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (e.button != 0) return;

                            const pageSlug = buildPageUrl(spaceSlug, value.slugId, value.title);

                            // opted to not use "replace" so that browser back button workers properly
                            navigate(pageSlug);
                        }}
                    >
                        <Group>
                            <Text m={6}>
                                {icons ? value.icon : ""} {value.title}
                            </Text>
                            {dividerType != "none" && <Divider className={classes.divider} variant={dividerType} />}
                        </Group>
                    </UnstyledButton>
                ));

                setChildPages(tocChildPages);
            } else {
                const contentHeadings = editor.getJSON().content?.filter((c) => c.type == "heading");

                const tocHeadings: JSX.Element[] = contentHeadings.map((value, index) => (
                    <UnstyledButton
                        key={`toc-${index}`}
                        className={classes.heading}
                        style={{
                            marginLeft: `calc(${value.attrs?.level - 1} * var(--mantine-spacing-md))`,
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
                            {dividerType != "none" && <Divider className={classes.divider} variant={dividerType} />}
                        </Group>
                    </UnstyledButton>
                ));

                setHeadings(tocHeadings);
            }
        })();
    }, [page == undefined, dividerType, tableType, icons]);

    return (
        <NodeViewWrapper>
            <NodeViewContent />
            <Stack
                gap={0}
                className={clsx(selected ? "ProseMirror-selectednode" : "")}
                contentEditable={false}
                onContextMenu={(e) => e.preventDefault()}
            >
                {tableType == "Contents" && headings}

                {tableType == "Child Pages" && childPages}
            </Stack>
        </NodeViewWrapper>
    );
}
