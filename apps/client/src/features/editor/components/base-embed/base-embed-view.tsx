import { NodeViewWrapper, NodeViewProps } from "@tiptap/react";
import { Box, Text } from "@mantine/core";
import { useEffect, useRef } from "react";
import { BaseTable } from "@/features/base/components/base-table";
import { useBaseQuery } from "@/features/base/queries/base-query";

const SIDE_GUTTER = 8;

// Walk up from `el` to find the closest ancestor that's meaningfully
// wider than `el` itself. That ancestor is the available drawing area
// our embed should expand into (e.g. AppShell.Main when the page sits
// inside a 900px Mantine Container). Returns null if no such ancestor
// exists — the embed then renders without extension.
function findWiderAncestor(el: HTMLElement): HTMLElement | null {
  const baseWidth = el.getBoundingClientRect().width;
  let cur: HTMLElement | null = el.parentElement;
  while (cur && cur !== document.body) {
    const w = cur.getBoundingClientRect().width;
    if (w > baseWidth + 32) return cur;
    cur = cur.parentElement;
  }
  return null;
}

function applyExtension(wrapper: HTMLDivElement) {
  const wrapperRect = wrapper.getBoundingClientRect();
  const wider = findWiderAncestor(wrapper);
  if (!wider) {
    wrapper.style.setProperty("--embed-shift", "0px");
    wrapper.style.setProperty("--embed-width", "100%");
    wrapper.style.setProperty("--embed-pad", "0px");
    return;
  }
  const widerRect = wider.getBoundingClientRect();
  const targetLeft = widerRect.left + SIDE_GUTTER;
  const targetWidth = widerRect.width - SIDE_GUTTER * 2;
  const shift = targetLeft - wrapperRect.left;
  wrapper.style.setProperty("--embed-shift", `${shift}px`);
  wrapper.style.setProperty("--embed-width", `${targetWidth}px`);
  // Re-pad inner content back to the original wrapper bounds so
  // toolbar buttons / first column visually align with page text.
  wrapper.style.setProperty("--embed-pad", `${-shift}px`);
}

export function BaseEmbedView({ node }: NodeViewProps) {
  const pageId = node.attrs.pageId as string | null;
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const update = () => applyExtension(wrapper);
    update();

    const ro = new ResizeObserver(update);
    ro.observe(wrapper);
    const wider = findWiderAncestor(wrapper);
    if (wider) ro.observe(wider);

    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  if (!pageId) {
    return (
      <NodeViewWrapper>
        <Box p="md">
          <Text c="red">Invalid base embed (missing page id)</Text>
        </Box>
      </NodeViewWrapper>
    );
  }

  const { isLoading, isError } = useBaseQuery(pageId);

  if (isLoading) {
    return (
      <NodeViewWrapper>
        <Box p="md">
          <Text c="dimmed">Loading...</Text>
        </Box>
      </NodeViewWrapper>
    );
  }

  if (isError) {
    return (
      <NodeViewWrapper>
        <Box p="md" bg="gray.0" style={{ borderRadius: 8 }}>
          <Text c="dimmed">You don't have access to this database.</Text>
        </Box>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper>
      <div ref={wrapperRef} style={{ minHeight: 200 }}>
        <BaseTable pageId={pageId} embedded />
      </div>
    </NodeViewWrapper>
  );
}
