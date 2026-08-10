import {
  ChangeEvent,
  ReactNode,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { Scroller, Tabs } from "@mantine/core";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import {
  draggable,
  dropTargetForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import {
  attachClosestEdge,
  extractClosestEdge,
  type Edge,
} from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import { getReorderDestinationIndex } from "@atlaskit/pragmatic-drag-and-drop-hitbox/util/get-reorder-destination-index";
import { autoScrollForElements } from "@atlaskit/pragmatic-drag-and-drop-auto-scroll/element";

const TAB_DRAG_TYPE = "editor-tab";

export default function TabsView(props: NodeViewProps) {
  const { node, editor, getPos } = props;
  const isEditable = editor.isEditable;
  const instanceId = useId();
  const stripRef = useRef<HTMLDivElement>(null);

  const tabs = useMemo(() => {
    return Array.from({ length: node.childCount }, (_, index) => {
      const labelNode = node.child(index)?.child(0);
      const labelText = labelNode?.textContent;
      const labelId = node.child(index)?.attrs?.id;

      return {
        label: labelText ?? "",
        id: labelId ?? index,
      };
    });
  }, [node]);

  const activeTab = clampIndex(node.attrs.activeTab);
  const [activeLabel, setActiveLabel] = useState(tabs[activeTab].label ?? "");

  useEffect(() => {
    setActiveLabel(tabs[activeTab].label);
  }, [activeTab, tabs]);

  const commitLabel = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const label = event.currentTarget.value;
      setActiveLabel(label);

      if (label === tabs[activeTab].label) return;
      if (typeof getPos === "function") {
        editor.commands.updateTabLabel?.(activeTab, label, getPos());
      }
    },
    [activeTab, editor, getPos, tabs]
  );

  const handleLabelKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      event.stopPropagation();
      if (event.key === "Escape") {
        event.preventDefault();
        event.currentTarget.blur();
      }
    },
    []
  );

  const handleActivate = useCallback(
    (index: number) => {
      if (typeof getPos === "function") {
        editor.commands.setActiveTab?.(index, getPos());
      }
    },
    [editor, getPos]
  );

  const handleReorder = useCallback(
    (from: number, to: number) => {
      if (typeof getPos === "function") {
        editor.commands.moveTab?.(from, to, getPos());
      }
    },
    [editor, getPos]
  );

  // pan the strip when a dragged tab nears its edges
  useEffect(() => {
    const scroller = stripRef.current?.querySelector<HTMLElement>(
      ".dm-tabs__scroller"
    );
    if (!scroller) return;

    return autoScrollForElements({
      element: scroller,
      canScroll: ({ source }) =>
        source.data.type === TAB_DRAG_TYPE &&
        source.data.instanceId === instanceId,
      getAllowedAxis: () => "horizontal",
    });
  }, [instanceId]);

  return (
    <NodeViewWrapper data-type="tabs">
      <Tabs value={String(activeTab)} color="dark">
        {/* data-tab-strip tells the Tabs extension to leave these drag events alone */}
        <Tabs.List ref={stripRef} data-tab-strip style={{ marginBottom: 10 }}>
          <Scroller
            draggable={false}
            classNames={{ container: "dm-tabs__scroller" }}
          >
            {tabs.map(({ label, id }, index) => (
              <TabSlot
                key={id}
                index={index}
                instanceId={instanceId}
                reorderEnabled={isEditable && tabs.length > 1}
                onActivate={handleActivate}
                onReorder={handleReorder}
              >
                {index === activeTab && isEditable ? (
                  <span className="dm-tabs__tab-label" data-value={activeLabel}>
                    <input
                      aria-label="Edit tab label"
                      className="dm-tabs__tab-input"
                      size={1}
                      value={activeLabel}
                      onChange={commitLabel}
                      onKeyDown={handleLabelKeyDown}
                    />
                  </span>
                ) : (
                  label
                )}
              </TabSlot>
            ))}
          </Scroller>
        </Tabs.List>
      </Tabs>

      <div className="dm-tabs__content">
        <NodeViewContent as="div" />
      </div>
    </NodeViewWrapper>
  );
}

type TabSlotProps = {
  index: number;
  instanceId: string;
  reorderEnabled: boolean;
  onActivate: (index: number) => void;
  onReorder: (from: number, to: number) => void;
  children: ReactNode;
};

function TabSlot({
  index,
  instanceId,
  reorderEnabled,
  onActivate,
  onReorder,
  children,
}: TabSlotProps) {
  const slotRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [closestEdge, setClosestEdge] = useState<Edge | null>(null);

  const onReorderRef = useRef(onReorder);
  useLayoutEffect(() => {
    onReorderRef.current = onReorder;
  });

  useEffect(() => {
    const el = slotRef.current;
    if (!el || !reorderEnabled) return;

    return combine(
      draggable({
        element: el,
        getInitialData: () => ({ type: TAB_DRAG_TYPE, instanceId, index }),
        onDragStart: () => setIsDragging(true),
        onDrop: () => setIsDragging(false),
      }),
      dropTargetForElements({
        element: el,
        canDrop: ({ source }) =>
          source.data.type === TAB_DRAG_TYPE &&
          source.data.instanceId === instanceId &&
          source.data.index !== index,
        getData: ({ input, element }) =>
          attachClosestEdge(
            { index },
            { input, element, allowedEdges: ["left", "right"] }
          ),
        onDrag: ({ self }) => setClosestEdge(extractClosestEdge(self.data)),
        onDragLeave: () => setClosestEdge(null),
        onDrop: ({ source, self }) => {
          setClosestEdge(null);

          const edge = extractClosestEdge(self.data);
          if (!edge) return;

          const startIndex = source.data.index as number;
          const finishIndex = getReorderDestinationIndex({
            startIndex,
            indexOfTarget: index,
            closestEdgeOfTarget: edge,
            axis: "horizontal",
          });

          if (finishIndex === startIndex) return;
          onReorderRef.current(startIndex, finishIndex);
        },
      })
    );
  }, [index, instanceId, reorderEnabled]);

  return (
    <div
      ref={slotRef}
      className="dm-tabs__tab-slot"
      data-dragging={isDragging || undefined}
      data-closest-edge={closestEdge ?? undefined}
    >
      <Tabs.Tab
        value={index.toString()}
        onFocus={(event) => event.currentTarget.blur()}
        onClick={(event) => {
          event.preventDefault();
          onActivate(index);
        }}
      >
        {children}
      </Tabs.Tab>
    </div>
  );
}

const clampIndex = (value: unknown, length = Number.MAX_SAFE_INTEGER) => {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed) || length <= 0) return 0;
  return Math.max(0, Math.min(Math.trunc(parsed), length - 1));
};
