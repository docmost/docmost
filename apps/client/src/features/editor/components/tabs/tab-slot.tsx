import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Tabs } from "@mantine/core";
import { useTranslation } from "react-i18next";
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
import TabActionsMenu from "./tab-actions-menu";
import TabRenameInput from "./tab-rename-input";
import type { TabActions } from "./tabs.types";

export const TAB_DRAG_TYPE = "editor-tab";

type TabSlotProps = {
  index: number;
  tabCount: number;
  label: string;
  isActive: boolean;
  isEditable: boolean;
  isRenaming: boolean;
  instanceId: string;
  contentId: string;
  actions: TabActions;
};

export default function TabSlot({
  index,
  tabCount,
  label,
  isActive,
  isEditable,
  isRenaming,
  instanceId,
  contentId,
  actions,
}: TabSlotProps) {
  const { t } = useTranslation();
  const slotRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [closestEdge, setClosestEdge] = useState<Edge | null>(null);
  const reorderEnabled = isEditable && tabCount > 1 && !isRenaming;

  const moveRef = useRef(actions.move);
  useLayoutEffect(() => {
    moveRef.current = actions.move;
  });

  useEffect(() => {
    const element = slotRef.current;
    if (!element || !reorderEnabled) return;

    return combine(
      draggable({
        element,
        getInitialData: () => ({ type: TAB_DRAG_TYPE, instanceId, index }),
        onDragStart: () => setIsDragging(true),
        onDrop: () => setIsDragging(false),
      }),
      dropTargetForElements({
        element,
        canDrop: ({ source }) =>
          source.data.type === TAB_DRAG_TYPE &&
          source.data.instanceId === instanceId &&
          source.data.index !== index,
        getData: ({ input, element: target }) =>
          attachClosestEdge(
            { index },
            { input, element: target, allowedEdges: ["left", "right"] },
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
          if (finishIndex !== startIndex) {
            moveRef.current(startIndex, finishIndex);
          }
        },
      }),
    );
  }, [index, instanceId, reorderEnabled]);

  return (
    <div
      ref={slotRef}
      className="dm-tabs__slot"
      data-tab-index={index}
      data-active={isActive || undefined}
      data-dragging={isDragging || undefined}
      data-closest-edge={closestEdge ?? undefined}
    >
      {isRenaming ? (
        <TabRenameInput
          initialValue={label}
          onDone={(value) => actions.finishRename(index, value)}
        />
      ) : (
        <Tabs.Tab
          value={String(index)}
          className="dm-tabs__tab"
          aria-controls={contentId}
          onDoubleClick={isEditable ? () => actions.rename(index) : undefined}
        >
          {label || t("Untitled")}
        </Tabs.Tab>
      )}
      {isActive && isEditable && !isRenaming && (
        <TabActionsMenu
          index={index}
          tabCount={tabCount}
          label={label}
          actions={actions}
        />
      )}
    </div>
  );
}
