import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Popover, Switch, Stack, Text, Group, UnstyledButton, ScrollArea } from "@mantine/core";
import { IconGripVertical, type IconLetterT } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { IBase, IBaseProperty, IBaseView } from "@/ee/base/types/base.types";
import { useUpdateViewMutation } from "@/ee/base/queries/base-view-query";
import { propertyTypes } from "@/ee/base/property-types/property-type.registry";
import { BaseDropEdgeIndicator } from "@/ee/base/components/grid/base-drop-edge-indicator";
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
import { reorder } from "@atlaskit/pragmatic-drag-and-drop/reorder";
import cellClasses from "@/ee/base/styles/cells.module.css";
import propClasses from "@/ee/base/styles/property.module.css";

const DRAG_TYPE = "base-card-property";

type KanbanCardPropertiesProps = {
  opened: boolean;
  onClose: () => void;
  base: IBase;
  view: IBaseView;
  pageId: string;
  children: React.ReactNode;
};

export function KanbanCardProperties({
  opened,
  onClose,
  base,
  view,
  pageId,
  children,
}: KanbanCardPropertiesProps) {
  const { t } = useTranslation();
  const updateView = useUpdateViewMutation();

  const nonPrimaryProperties = base.properties.filter((p) => !p.isPrimary);
  const visibleIds = view.config?.visiblePropertyIds ?? [];

  const savedOrder = view.config?.propertyOrder ?? [];
  const orderedProperties = [
    ...savedOrder
      .map((id) => nonPrimaryProperties.find((p) => p.id === id))
      .filter((p): p is IBaseProperty => p !== undefined),
    ...nonPrimaryProperties.filter((p) => !savedOrder.includes(p.id)),
  ];

  const primaryProperty = base.properties.find((p) => p.isPrimary);
  const PrimaryIcon = primaryProperty
    ? propertyTypes.find((pt) => pt.type === primaryProperty.type)?.icon
    : undefined;

  const handleToggle = useCallback(
    (propertyId: string, checked: boolean) => {
      const next = checked
        ? [...visibleIds, propertyId]
        : visibleIds.filter((id) => id !== propertyId);
      updateView.mutate({ viewId: view.id, pageId, config: { visiblePropertyIds: next } });
    },
    [updateView, view.id, visibleIds, pageId],
  );

  const handleReorder = useCallback(
    (activeId: string, targetId: string, edge: Edge) => {
      const startIndex = orderedProperties.findIndex((p) => p.id === activeId);
      const indexOfTarget = orderedProperties.findIndex((p) => p.id === targetId);
      if (startIndex === -1 || indexOfTarget === -1) return;
      const finishIndex = getReorderDestinationIndex({
        startIndex,
        indexOfTarget,
        closestEdgeOfTarget: edge,
        axis: "vertical",
      });
      if (finishIndex === startIndex) return;
      const reordered = reorder({ list: orderedProperties, startIndex, finishIndex });
      updateView.mutate({
        viewId: view.id,
        pageId,
        config: { propertyOrder: reordered.map((p) => p.id) },
      });
    },
    [orderedProperties, updateView, view.id, pageId],
  );

  return (
    <Popover
      opened={opened}
      onChange={(o) => {
        if (!o) onClose();
      }}
      onClose={onClose}
      position="bottom-end"
      shadow="md"
      width={260}
      trapFocus
      closeOnEscape
      closeOnClickOutside
      withinPortal
    >
      <Popover.Target>{children}</Popover.Target>
      <Popover.Dropdown p="xs">
        <Stack gap={4}>
          <Group justify="space-between" px={4} py={2}>
            <Text size="xs" fw={600} c="dimmed">
              {t("Card properties")}
            </Text>
          </Group>
          <ScrollArea.Autosize mah="min(60vh, 420px)" scrollbarSize={6} offsetScrollbars>
          <Stack gap={0}>
            {primaryProperty && (
              <div className={cellClasses.menuItem} style={{ paddingLeft: 4, cursor: "default" }}>
                <div className={propClasses.dragHandle} style={{ visibility: "hidden" }}>
                  <IconGripVertical size={14} />
                </div>
                <Group gap={8} wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                  {PrimaryIcon && <PrimaryIcon size={14} style={{ flexShrink: 0 }} />}
                  <Text size="sm" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {primaryProperty.name}
                  </Text>
                </Group>
                <Switch
                  size="xs"
                  checked
                  disabled
                  onChange={() => {}}
                  styles={{ track: { cursor: "default" } }}
                />
              </div>
            )}
            {orderedProperties.map((p) => {
              const isVisible = visibleIds.includes(p.id);
              const typeConfig = propertyTypes.find((pt) => pt.type === p.type);
              const TypeIcon = typeConfig?.icon;
              return (
                <SortablePropertyRow
                  key={p.id}
                  property={p}
                  isVisible={isVisible}
                  TypeIcon={TypeIcon}
                  onToggle={handleToggle}
                  onReorder={handleReorder}
                />
              );
            })}
          </Stack>
          </ScrollArea.Autosize>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}

type SortablePropertyRowProps = {
  property: IBaseProperty;
  isVisible: boolean;
  TypeIcon: typeof IconLetterT | undefined;
  onToggle: (propertyId: string, checked: boolean) => void;
  onReorder: (activeId: string, targetId: string, edge: Edge) => void;
};

function SortablePropertyRow({
  property,
  isVisible,
  TypeIcon,
  onToggle,
  onReorder,
}: SortablePropertyRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [closestEdge, setClosestEdge] = useState<Edge | null>(null);

  const onReorderRef = useRef(onReorder);
  useLayoutEffect(() => {
    onReorderRef.current = onReorder;
  });

  useEffect(() => {
    const row = rowRef.current;
    const handle = handleRef.current;
    if (!row || !handle) return;
    return combine(
      draggable({
        element: row,
        dragHandle: handle,
        getInitialData: () => ({ type: DRAG_TYPE, propertyId: property.id }),
        onDragStart: () => setIsDragging(true),
        onDrop: () => setIsDragging(false),
      }),
      dropTargetForElements({
        element: row,
        canDrop: ({ source }) =>
          source.data.type === DRAG_TYPE && source.data.propertyId !== property.id,
        getData: ({ input, element }) =>
          attachClosestEdge(
            { propertyId: property.id },
            { input, element, allowedEdges: ["top", "bottom"] },
          ),
        onDrag: ({ self }) => setClosestEdge(extractClosestEdge(self.data)),
        onDragLeave: () => setClosestEdge(null),
        onDrop: ({ source, self }) => {
          setClosestEdge(null);
          const edge = extractClosestEdge(self.data);
          if (!edge) return;
          onReorderRef.current(source.data.propertyId as string, property.id, edge);
        },
      }),
    );
  }, [property.id]);

  return (
    <div
      ref={rowRef}
      style={{ position: "relative", opacity: isDragging ? 0.4 : 1 }}
    >
      <UnstyledButton
        className={cellClasses.menuItem}
        onClick={() => onToggle(property.id, !isVisible)}
        style={{ paddingLeft: 4 }}
      >
        <div ref={handleRef} className={propClasses.dragHandle} onClick={(e) => e.stopPropagation()}>
          <IconGripVertical size={14} style={{ opacity: 0.4 }} />
        </div>
        <Group gap={8} wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
          {TypeIcon && <TypeIcon size={14} style={{ flexShrink: 0 }} />}
          <Text size="sm" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {property.name}
          </Text>
        </Group>
        <Switch
          size="xs"
          checked={isVisible}
          onChange={() => {}}
          onClick={(e) => e.stopPropagation()}
          styles={{ track: { cursor: "pointer" } }}
        />
      </UnstyledButton>
      {closestEdge && <BaseDropEdgeIndicator edge={closestEdge} />}
    </div>
  );
}
