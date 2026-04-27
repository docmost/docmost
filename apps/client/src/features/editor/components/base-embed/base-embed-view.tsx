import { NodeViewWrapper, NodeViewProps } from "@tiptap/react";
import { Box, Text } from "@mantine/core";
import { useEffect, useRef } from "react";
import { BaseTable } from "@/features/base/components/base-table";
import { useBaseQuery } from "@/features/base/queries/base-query";

const SIDE_GUTTER = 8;

// Anchor directly to AppShell.Main (the <main> tag) for both sides.
// This is the layout container that already accounts for the navbar's
// width and sidebar collapse state — its left/right edges are exactly
// where the embed should extend to.
function applyExtension(wrapper: HTMLDivElement) {
  const rect = wrapper.getBoundingClientRect();
  if (rect.width === 0) return;

  const main = wrapper.closest("main") as HTMLElement | null;
  const mainRect = main?.getBoundingClientRect();

  const targetLeft = (mainRect?.left ?? 0) + SIDE_GUTTER;
  const targetRight = mainRect
    ? mainRect.right - SIDE_GUTTER
    : window.innerWidth - SIDE_GUTTER;

  const extendLeft = Math.max(0, rect.left - targetLeft);
  const extendRight = Math.max(0, targetRight - rect.right);

  wrapper.style.setProperty("--embed-extend-l", `${extendLeft}px`);
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
