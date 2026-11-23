import { useEffect, useEffectEvent, useRef, useState } from "react";
import { Menu } from "@mantine/core";
import {
  IconArrowDown,
  IconArrowUp,
  IconGripVertical,
} from "@tabler/icons-react";
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
import { BaseDropEdgeIndicator } from "@/ee/base/components/grid/base-drop-edge-indicator";
import { getDescriptor } from "@/ee/base/property-types/property-type.registry";
import { PagePropertyInput } from "./page-property-input";
import { PagePropertyValue } from "./page-property-value";
import type {
  PageProperty,
  SavePagePropertyChoices,
} from "./page-property.types";
import classes from "./page-properties.module.css";

type Props = {
  property: PageProperty;
  editable: boolean;
  first: boolean;
  last: boolean;
  onEdit: () => void;
  onChange: (value: unknown) => void;
  onSaveChoices: SavePagePropertyChoices;
  onReorder: (sourceId: string, targetId: string, edge: Edge) => void;
  onMove: (offset: -1 | 1) => void;
};

export function PagePropertyRow({
  property,
  editable,
  first,
  last,
  onEdit,
  onChange,
  onSaveChoices,
  onReorder,
  onMove,
}: Props) {
  const { t } = useTranslation();
  const rowRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLButtonElement>(null);
  const [edge, setEdge] = useState<Edge | null>(null);
  const reorder = useEffectEvent(onReorder);
  const { id, pageId, name, type } = property;
  const Icon = getDescriptor(type).icon;
  const canMove = editable && !(first && last);
  useEffect(() => {
    const handle = handleRef.current;
    const row = rowRef.current;
    if (!canMove || !row || !handle) return;
    return combine(
      draggable({
        element: handle,
        getInitialData: () => ({ type: "page-property", pageId, id }),
        onGenerateDragPreview: ({ nativeSetDragImage }) =>
          nativeSetDragImage?.(row, 0, 0),
      }),
      dropTargetForElements({
        element: row,
        canDrop: ({ source }) =>
          source.data.type === "page-property" &&
          source.data.pageId === pageId &&
          source.data.id !== id,
        getData: ({ input, element }) =>
          attachClosestEdge(
            {},
            { input, element, allowedEdges: ["top", "bottom"] },
          ),
        onDrag: ({ self }) => setEdge(extractClosestEdge(self.data)),
        onDragLeave: () => setEdge(null),
        onDrop: ({ source, self }) => {
          setEdge(null);
          const side = extractClosestEdge(self.data);
          if (side) reorder(source.data.id as string, id, side);
        },
      }),
    );
  }, [id, pageId, canMove]);

  const label = (
    <>
      <Icon size={15} aria-hidden />
      <span>{name}</span>
    </>
  );
  return (
    <div className={classes.row} ref={rowRef}>
      <dt>
        {canMove && (
          <Menu position="bottom-start" shadow="sm" withinPortal>
            <Menu.Target>
              <button
                className={classes.handle}
                ref={handleRef}
                type="button"
                aria-label={t("Reorder {{name}}", { name })}
                aria-keyshortcuts="ArrowUp ArrowDown"
                onKeyDownCapture={(event) => {
                  if (event.key !== "ArrowUp" && event.key !== "ArrowDown")
                    return;
                  event.preventDefault();
                  event.stopPropagation();
                  onMove(event.key === "ArrowUp" ? -1 : 1);
                  requestAnimationFrame(() => handleRef.current?.focus());
                }}
              >
                <IconGripVertical size={15} aria-hidden />
              </button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                disabled={first}
                leftSection={<IconArrowUp size={14} />}
                onClick={() => onMove(-1)}
              >
                {t("Move up")}
              </Menu.Item>
              <Menu.Item
                disabled={last}
                leftSection={<IconArrowDown size={14} />}
                onClick={() => onMove(1)}
              >
                {t("Move down")}
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        )}
        {editable ? (
          <button
            type="button"
            onClick={onEdit}
            className={classes.label}
            aria-label={t("Edit property {{name}}", { name })}
          >
            {label}
          </button>
        ) : (
          <span className={classes.label}>{label}</span>
        )}
      </dt>
      <dd className={classes.value}>
        {editable ? (
          <PagePropertyInput
            property={property}
            onChange={onChange}
            onSaveChoices={onSaveChoices}
          />
        ) : (
          <PagePropertyValue property={property} links />
        )}
        {edge && <BaseDropEdgeIndicator edge={edge} />}
      </dd>
    </div>
  );
}
