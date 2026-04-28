import { useState, useCallback } from "react";
import {
  Group,
  UnstyledButton,
  Text,
  ActionIcon,
  Tooltip,
  TextInput,
  Menu,
} from "@mantine/core";
import { IconPlus, IconPencil, IconTrash, IconTable } from "@tabler/icons-react";
import { IBaseView } from "@/features/base/types/base.types";
import {
  useUpdateViewMutation,
  useDeleteViewMutation,
} from "@/features/base/queries/base-view-query";
import { useTranslation } from "react-i18next";

type ViewTabsProps = {
  views: IBaseView[];
  activeViewId: string | undefined;
  pageId: string;
  onViewChange: (viewId: string) => void;
  onAddView?: () => void;
};

export function ViewTabs({
  views,
  activeViewId,
  pageId,
  onViewChange,
  onAddView,
}: ViewTabsProps) {
  const { t } = useTranslation();
  const [editingViewId, setEditingViewId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const updateViewMutation = useUpdateViewMutation();
  const deleteViewMutation = useDeleteViewMutation();

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
      if (views.length <= 1) return;
      deleteViewMutation.mutate({ viewId, pageId });
      if (viewId === activeViewId && views.length > 1) {
        const remaining = views.filter((v) => v.id !== viewId);
        onViewChange(remaining[0].id);
      }
    },
    [views, pageId, activeViewId, deleteViewMutation, onViewChange],
  );

  return (
    <Group gap={4}>
      {views.map((view) => (
        <ViewTab
          key={view.id}
          view={view}
          isActive={view.id === activeViewId}
          isEditing={view.id === editingViewId}
          editingName={editingName}
          canDelete={views.length > 1}
          onClick={() => onViewChange(view.id)}
          onRenameStart={() => handleRenameStart(view)}
          onRenameChange={setEditingName}
          onRenameCommit={handleRenameCommit}
          onRenameKeyDown={handleRenameKeyDown}
          onDelete={() => handleDelete(view.id)}
        />
      ))}
      {onAddView && (
        <Tooltip label={t("Add view")}>
          <ActionIcon
            variant="subtle"
            size="sm"
            color="gray"
            onClick={onAddView}
          >
            <IconPlus size={14} />
          </ActionIcon>
        </Tooltip>
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
  onClick,
  onRenameStart,
  onRenameChange,
  onRenameCommit,
  onRenameKeyDown,
  onDelete,
}: {
  view: IBaseView;
  isActive: boolean;
  isEditing: boolean;
  editingName: string;
  canDelete: boolean;
  onClick: () => void;
  onRenameStart: () => void;
  onRenameChange: (name: string) => void;
  onRenameCommit: () => void;
  onRenameKeyDown: (e: React.KeyboardEvent) => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const [menuOpened, setMenuOpened] = useState(false);

  if (isEditing) {
    return (
      <TextInput
        size="xs"
        w={120}
        value={editingName}
        onChange={(e) => onRenameChange(e.currentTarget.value)}
        onBlur={onRenameCommit}
        onKeyDown={onRenameKeyDown}
        autoFocus
      />
    );
  }

  return (
    <Menu
      opened={menuOpened}
      onChange={setMenuOpened}
      position="bottom-start"
      shadow="md"
      width={180}
      withinPortal
      // Default Menu behavior: closeOnClickOutside, closeOnEscape, and
      // closeOnItemClick all true — replaces the manual setMenuOpened
      // calls and gives the popover the same outside-click / Esc
      // semantics every other Mantine menu in the app has.
    >
      <Menu.Target>
        <UnstyledButton
          onClick={onClick}
          onContextMenu={(e) => {
            e.preventDefault();
            setMenuOpened(true);
          }}
          style={{
            padding: "4px 10px",
            borderRadius: "var(--mantine-radius-sm)",
            fontWeight: isActive ? 600 : 400,
          }}
        >
          <Group gap={6} wrap="nowrap">
            <IconTable size={14} opacity={0.5} />
            <Text
              size="sm"
              c={isActive ? undefined : "dimmed"}
            >
              {view.name}
            </Text>
          </Group>
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item
          leftSection={<IconPencil size={14} />}
          onClick={onRenameStart}
        >
          {t("Rename")}
        </Menu.Item>
        {canDelete && (
          <>
            <Menu.Divider />
            <Menu.Item
              leftSection={<IconTrash size={14} />}
              onClick={onDelete}
              color="red"
            >
              {t("Delete view")}
            </Menu.Item>
          </>
        )}
      </Menu.Dropdown>
    </Menu>
  );
}
