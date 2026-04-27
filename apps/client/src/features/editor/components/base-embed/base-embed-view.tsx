import { NodeViewWrapper, NodeViewProps } from "@tiptap/react";
import { Box, Text } from "@mantine/core";
import { useEffect, useRef } from "react";
import { BaseTable } from "@/features/base/components/base-table";
import { BaseTableSkeleton } from "@/features/base/components/base-table-skeleton";
import { useBaseQuery } from "@/features/base/queries/base-query";

const SIDE_GUTTER = 8;

// Extend the scroll viewport on both sides (toward AppShell.Main's
// edges), but offset the grid content with padding-left = extendLeft
// so the first cell still lines up with page-content on load. The
// extra leftward area becomes scrollable empty space the user can
// pan into — same behavior as Notion's inline databases.
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
  wrapper.style.setProperty("--embed-grid-pad-left", `${extendLeft}px`);
  // Symmetric right-side padding so the user can pan past the last
  // column into empty space — same behaviour as Notion, gives the
  // table breathing room on the right when scrolled fully right.
  wrapper.style.setProperty("--embed-grid-pad-right", `${extendRight}px`);
  // Inline sticky band clears the fixed PageHeader. Standalone leaves
  // the var unset (resolves to the rule default of 0).
  wrapper.style.setProperty(
    "--sticky-band-top",
    "var(--page-header-height)",
  );
}

export function BaseEmbedView({ node }: NodeViewProps) {
  const pageId = node.attrs.pageId as string | null;
  const pendingKey = node.attrs.pendingKey as string | null;
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  // Suppress the query while the slash command is still waiting for the
  // server to assign a pageId — useBaseQuery would otherwise fire with
  // an empty key and surface a transient error.
  const { isLoading, isError } = useBaseQuery(pendingKey ? "" : pageId ?? "");

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
  if (pendingKey) {
    // Slash command inserted the embed and is awaiting the server's
    // assigned pageId. Render with `rows={0}` so the placeholder
    // matches the height of the eventual empty base shell — anything
    // taller would shrink hundreds of px on swap, and on a short doc
    // the browser would clamp scrollY (looks like "page jumps to top
    // of editor" when the create response lands). The slash command
    // also prefills the React Query cache so BaseTable mounts with
    // baseLoading/rowsLoading already false and skips its own skeleton.
    content = <BaseTableSkeleton rows={0} />;
  } else if (!pageId) {
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
