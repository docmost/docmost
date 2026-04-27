import { NodeViewWrapper, NodeViewProps } from "@tiptap/react";
import { Box, Text } from "@mantine/core";
import { useEffect, useRef } from "react";
import { BaseTable } from "@/features/base/components/base-table";
import { useBaseQuery } from "@/features/base/queries/base-query";

const SIDE_GUTTER = 8;

// Extend the grid only to the right — toward AppShell.Main's right
// edge. The left edge stays at the wrapper's natural (page-content)
// position so the table is visually aligned with the page text on
// load, matching Notion. Leftward scroll-viewport extension is only
// meaningful once we add frozen columns that need to lock at the
// sidebar edge; deferred until then.
function applyExtension(wrapper: HTMLDivElement) {
  const rect = wrapper.getBoundingClientRect();
  if (rect.width === 0) return;

  const main = wrapper.closest("main") as HTMLElement | null;
  const targetRight = main
    ? main.getBoundingClientRect().right - SIDE_GUTTER
    : window.innerWidth - SIDE_GUTTER;

  const extendRight = Math.max(0, targetRight - rect.right);
  wrapper.style.setProperty("--embed-extend-r", `${extendRight}px`);
}

export function BaseEmbedView({ node }: NodeViewProps) {
  const pageId = node.attrs.pageId as string | null;
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const { isLoading, isError } = useBaseQuery(pageId ?? "");

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const update = () => applyExtension(wrapper);
    update();

    const ro = new ResizeObserver(update);
    ro.observe(wrapper);
    // Sidebar collapse changes <main>'s left/width without resizing
    // the wrapper itself, so observe <main> too.
    const main = wrapper.closest("main");
    if (main) ro.observe(main);

    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [isLoading, isError, pageId]);

  let content: React.ReactNode;
  if (!pageId) {
    content = (
      <Box p="md">
        <Text c="red">Invalid base embed (missing page id)</Text>
      </Box>
    );
  } else if (isLoading) {
    content = (
      <Box p="md">
        <Text c="dimmed">Loading...</Text>
      </Box>
    );
  } else if (isError) {
    content = (
      <Box p="md" bg="gray.0" style={{ borderRadius: 8 }}>
        <Text c="dimmed">You don't have access to this database.</Text>
      </Box>
    );
  } else {
    content = <BaseTable pageId={pageId} embedded />;
  }

  return (
    <NodeViewWrapper>
      <div ref={wrapperRef} style={{ minHeight: 200 }}>
        {content}
      </div>
    </NodeViewWrapper>
  );
}
