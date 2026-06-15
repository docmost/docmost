import {
  useState,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import {
  Group,
  UnstyledButton,
  Text,
  TextInput,
  Popover,
  Stack,
  Divider,
} from "@mantine/core";
import {
  IconPencil,
  IconTrash,
  IconTable,
  IconLink,
  IconLayoutKanban,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
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
import { generateJitteredKeyBetween } from "fractional-indexing-jittered";
import { IBase, IBaseView } from "@/ee/base/types/base.types";
import { ViewCreateMenu } from "@/ee/base/components/views/view-create-menu";
import {
  useUpdateViewMutation,
  useDeleteViewMutation,
} from "@/ee/base/queries/base-view-query";
import { useTranslation } from "react-i18next";
import cellClasses from "@/ee/base/styles/cells.module.css";
import { useBaseEditable } from "@/ee/base/context/base-editable";
import { BaseDropEdgeIndicator } from "@/ee/base/components/grid/base-drop-edge-indicator";

const VIEW_DRAG_TYPE = "base-view";

type ViewTabsProps = {
  views: IBaseView[];
  activeViewId: string | undefined;
  pageId: string;
  onViewChange: (viewId: string) => void;
  onAddView?: () => void;
  base?: IBase;
  canAddView?: boolean;
  /** Standalone base-page link for a view, used by "Copy link to view". */
  getViewShareUrl?: (viewId: string) => string | null;
};

export function ViewTabs({
  views,
  activeViewId,
  pageId,
  onViewChange,
  onAddView,
  base,
  canAddView,
  getViewShareUrl,
}: ViewTabsProps) {
  const { t } = useTranslation();
  const editable = useBaseEditable();
  const [editingViewId, setEditingViewId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const updateViewMutation = useUpdateViewMutation();
  const deleteViewMutation = useDeleteViewMutation();

  const orderedViews = useMemo(
    () =>
      [...views].sort((a, b) =>
        a.position < b.position ? -1 : a.position > b.position ? 1 : 0,
      ),
    [views],
  );

  const handleReorder = useCallback(
    (sourceId: string, targetId: string, edge: Edge) => {
      if (sourceId === targetId) return;
      const remaining = orderedViews.filter((v) => v.id !== sourceId);
      const targetIndex = remaining.findIndex((v) => v.id === targetId);
      if (targetIndex === -1) return;

      let lowerPos: string | null = null;
      let upperPos: string | null = null;
      if (edge === "left") {
        lowerPos =
          targetIndex > 0 ? remaining[targetIndex - 1]?.position : null;
        upperPos = remaining[targetIndex]?.position ?? null;
      } else {
        lowerPos = remaining[targetIndex]?.position ?? null;
        upperPos =
          targetIndex < remaining.length - 1
            ? remaining[targetIndex + 1]?.position
            : null;
      }

      try {
        const position =
          lowerPos && upperPos && lowerPos === upperPos
            ? generateJitteredKeyBetween(lowerPos, null)
            : generateJitteredKeyBetween(lowerPos, upperPos);
        updateViewMutation.mutate({ viewId: sourceId, pageId, position });
      } catch {
        // Position computation failed; skip the reorder.
      }
    },
    [orderedViews, pageId, updateViewMutation],
  );

  const handleRenameStart = useCallback(
    (view: IBaseView) => {
      setEditingViewId(view.id);
      setEditingName(view.name);
    },
    [],
  );

  const handleRenameCommit = useCallback(() => {
    if (!editingViewId) return;
    const trimmed = editingName.trim();
    const view = views.find((v) => v.id === editingViewId);
    if (trimmed && view && trimmed !== view.name) {
      updateViewMutation.mutate({
        viewId: editingViewId,
        pageId,
        name: trimmed,
      });
    }
    setEditingViewId(null);
  }, [editingViewId, editingName, views, pageId, updateViewMutation]);

  const handleRenameKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleRenameCommit();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setEditingViewId(null);
      }
    },
    [handleRenameCommit],
  );

  const handleDelete = useCallback(
    (viewId: string) => {
      if (orderedViews.length <= 1) return;
      deleteViewMutation.mutate({ viewId, pageId });
      if (viewId === activeViewId) {
        const remaining = orderedViews.filter((v) => v.id !== viewId);
        onViewChange(remaining[0].id);
      }
    },
    [orderedViews, pageId, activeViewId, deleteViewMutation, onViewChange],
  );

  return (
    <Group gap={4}>
      {orderedViews.map((view) => (
        <ViewTab
          key={view.id}
          view={view}
          isActive={view.id === activeViewId}
          isEditing={view.id === editingViewId}
          editingName={editingName}
          canDelete={orderedViews.length > 1}
          reorderEnabled={editable && orderedViews.length > 1}
          onReorder={handleReorder}
          onClick={() => onViewChange(view.id)}
          onRenameStart={() => handleRenameStart(view)}
          onRenameChange={setEditingName}
          onRenameCommit={handleRenameCommit}
          onRenameKeyDown={handleRenameKeyDown}
          onDelete={() => handleDelete(view.id)}
          getViewShareUrl={getViewShareUrl}
        />
      ))}
      {canAddView && base && (
        <ViewCreateMenu base={base} pageId={pageId} />
      )}
    </Group>
  );
}

function ViewTab({
  view,
  isActive,
  isEditing,
  editingName,
  canDelete,
  reorderEnabled,
  onReorder,
  onClick,
  onRenameStart,
  onRenameChange,
  onRenameCommit,
  onRenameKeyDown,
  onDelete,
  getViewShareUrl,
}: {
  view: IBaseView;
  isActive: boolean;
  isEditing: boolean;
  editingName: string;
  canDelete: boolean;
  reorderEnabled: boolean;
  onReorder: (sourceId: string, targetId: string, edge: Edge) => void;
  onClick: () => void;
  onRenameStart: () => void;
  onRenameChange: (name: string) => void;
  onRenameCommit: () => void;
  onRenameKeyDown: (e: React.KeyboardEvent) => void;
  onDelete: () => void;
  getViewShareUrl?: (viewId: string) => string | null;
}) {
  const { t } = useTranslation();
  const [menuOpened, setMenuOpened] = useState(false);
  const editable = useBaseEditable();
  const tabRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [closestEdge, setClosestEdge] = useState<Edge | null>(null);

  const onReorderRef = useRef(onReorder);
  useLayoutEffect(() => {
    onReorderRef.current = onReorder;
  });

  useEffect(() => {
    const el = tabRef.current;
    if (!el || !reorderEnabled || isEditing) return;
    return combine(
      draggable({
        element: el,
        getInitialData: () => ({ type: VIEW_DRAG_TYPE, viewId: view.id }),
        onDragStart: () => setIsDragging(true),
        onDrop: () => setIsDragging(false),
      }),
      dropTargetForElements({
        element: el,
        canDrop: ({ source }) =>
          source.data.type === VIEW_DRAG_TYPE &&
          source.data.viewId !== view.id,
        getData: ({ input, element }) =>
          attachClosestEdge(
            { viewId: view.id },
            { input, element, allowedEdges: ["left", "right"] },
          ),
        onDrag: ({ self }) => setClosestEdge(extractClosestEdge(self.data)),
        onDragLeave: () => setClosestEdge(null),
        onDrop: ({ source, self }) => {
          setClosestEdge(null);
          const edge = extractClosestEdge(self.data);
          if (!edge) return;
          onReorderRef.current(source.data.viewId as string, view.id, edge);
        },
      }),
    );
  }, [view.id, reorderEnabled, isEditing]);

  const handleTabClick = useCallback(() => {
    if (isActive) {
      setMenuOpened((o) => !o);
    } else {
      onClick();
    }
  }, [isActive, onClick]);

  const handleCopyLink = useCallback(() => {
    setMenuOpened(false);
    const url = getViewShareUrl?.(view.id);
    if (!url) return;
    void navigator.clipboard.writeText(url);
    notifications.show({ message: t("Link copied to clipboard") });
  }, [getViewShareUrl, view.id, t]);

  if (isEditing) {
    return (
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          padding: "1px 10px",
          border: "1px solid var(--mantine-color-default-border)",
          borderRadius: "var(--mantine-radius-xl)",
        }}
      >
        <TextInput
          variant="unstyled"
          size="xs"
          value={editingName}
          onChange={(e) => onRenameChange(e.currentTarget.value)}
          onBlur={onRenameCommit}
          onKeyDown={onRenameKeyDown}
          autoFocus
          styles={{
            input: {
              height: "auto",
              minHeight: 0,
              padding: 0,
              width: 100,
              fontSize: "var(--mantine-font-size-sm)",
              lineHeight: 1.2,
            },
          }}
        />
      </div>
    );
  }

  return (
    <div
      ref={tabRef}
      style={{
        position: "relative",
        display: "inline-flex",
        opacity: isDragging ? 0.4 : 1,
      }}
    >
      <Popover
        opened={menuOpened}
        onChange={setMenuOpened}
        position="bottom-start"
        shadow="md"
        width={180}
        trapFocus
        closeOnEscape
        closeOnClickOutside
        withinPortal
      >
        <Popover.Target>
          <UnstyledButton
            onClick={handleTabClick}
            style={{
              padding: "2px 10px",
              borderRadius: "var(--mantine-radius-xl)",
              fontWeight: isActive ? 600 : 400,
              backgroundColor: isActive
                ? "light-dark(var(--mantine-color-gray-2), var(--mantine-color-dark-5))"
                : undefined,
            }}
          >
            <Group gap={6} wrap="nowrap">
              {view.type === "kanban" ? (
                <IconLayoutKanban size={14} opacity={isActive ? 1 : 0.5} />
              ) : (
                <IconTable size={14} opacity={isActive ? 1 : 0.5} />
              )}
              <Text size="sm" lh={1.2} c={isActive ? undefined : "dimmed"}>
                {view.name}
              </Text>
            </Group>
          </UnstyledButton>
        </Popover.Target>
      <Popover.Dropdown p={4}>
        <Stack gap={0}>
          {editable && (
            <UnstyledButton
              className={cellClasses.menuItem}
              onClick={() => {
                setMenuOpened(false);
                onRenameStart();
              }}
            >
              <Group gap={8} wrap="nowrap">
                <IconPencil size={14} />
                <Text size="sm">{t("Rename")}</Text>
              </Group>
            </UnstyledButton>
          )}
          {getViewShareUrl && (
            <UnstyledButton
              className={cellClasses.menuItem}
              onClick={handleCopyLink}
            >
              <Group gap={8} wrap="nowrap">
                <IconLink size={14} />
                <Text size="sm">{t("Copy link to view")}</Text>
              </Group>
            </UnstyledButton>
          )}
          {editable && canDelete && (
            <>
              <Divider my={4} />
              <UnstyledButton
                className={cellClasses.menuItem}
                onClick={() => {
                  setMenuOpened(false);
                  onDelete();
                }}
                style={{ color: "var(--mantine-color-red-6)" }}
              >
                <Group gap={8} wrap="nowrap">
                  <IconTrash size={14} />
                  <Text size="sm">{t("Delete view")}</Text>
                </Group>
              </UnstyledButton>
            </>
          )}
        </Stack>
      </Popover.Dropdown>
      </Popover>
      {closestEdge && <BaseDropEdgeIndicator edge={closestEdge} />}
    </div>
  );
}
