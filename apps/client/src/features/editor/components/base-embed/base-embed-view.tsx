import { NodeViewWrapper, NodeViewProps } from "@tiptap/react";
import { Box, Text } from "@mantine/core";
import { useEffect, useRef } from "react";
import { BaseTable } from "@/features/base/components/base-table";
import { useBaseQuery } from "@/features/base/queries/base-query";

const RIGHT_GUTTER = 16;
const LEFT_GUTTER = 8;

// Measure how far we can extend the grid past the wrapper's natural
// (parent-constrained) bounds, and write the values as CSS vars on the
// wrapper so the descendant grid can consume them via margin.
function applyExtension(wrapper: HTMLDivElement) {
  const rect = wrapper.getBoundingClientRect();
  if (rect.width === 0) return;

  const extendRight = Math.max(
    0,
    window.innerWidth - rect.right - RIGHT_GUTTER,
  );

  // Find the leftmost the grid can reach: walk up the ancestor chain
  // for the closest element wider than the wrapper. That ancestor's
  // left edge (plus a small gutter) is our left target. This handles
  // the sidebar-collapsed case naturally — the wider ancestor is
  // AppShell.Main, whose left edge moves when the sidebar toggles.
  let targetLeft = rect.left;
  let cur: HTMLElement | null = wrapper.parentElement;
  while (cur && cur !== document.body) {
    const r = cur.getBoundingClientRect();
    if (r.width > rect.width + 32) {
      targetLeft = r.left + LEFT_GUTTER;
      break;
    }
    cur = cur.parentElement;
  }
  const extendLeft = Math.max(0, rect.left - targetLeft);

  wrapper.style.setProperty("--embed-extend-r", `${extendRight}px`);
  wrapper.style.setProperty("--embed-extend-l", `${extendLeft}px`);
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
    // Also observe an ancestor so sidebar collapse / window changes
    // propagate even when the wrapper itself doesn't resize.
    let cur: HTMLElement | null = wrapper.parentElement;
    while (cur && cur !== document.body) {
      const r = cur.getBoundingClientRect();
      if (r.width > wrapper.getBoundingClientRect().width + 32) {
        ro.observe(cur);
        break;
      }
      cur = cur.parentElement;
    }

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
