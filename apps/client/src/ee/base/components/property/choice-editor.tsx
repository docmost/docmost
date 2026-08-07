import { useState, useCallback, useMemo, useEffect, useRef, useLayoutEffect } from "react";
import {
  TextInput,
  Group,
  Stack,
  Text,
  Button,
  Popover,
  SimpleGrid,
  UnstyledButton,
  CloseButton,
  Divider,
} from "@mantine/core";
import {
  IconPlus,
  IconGripVertical,
  IconArrowsSort,
} from "@tabler/icons-react";
import classes from "@/ee/base/styles/property.module.css";
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
import { triggerPostMoveFlash } from "@atlaskit/pragmatic-drag-and-drop-flourish/trigger-post-move-flash";
import * as liveRegion from "@atlaskit/pragmatic-drag-and-drop-live-region";
import { BaseDropEdgeIndicator } from "@/ee/base/components/grid/base-drop-edge-indicator";
import { Choice } from "@/ee/base/types/base.types";
import { choiceColor } from "@/ee/base/components/cells/choice-color";
import { useTranslation } from "react-i18next";
import { generateBaseChoiceId } from "@/ee/base/utils/generate-base-id";
import { DefaultValuePicker } from "./default-value-picker";

const CHOICE_COLORS = [
  "gray", "red", "pink", "grape", "violet", "indigo",
  "blue", "cyan", "teal", "green", "lime", "yellow", "orange",
];

const STATUS_CATEGORIES = [
  { value: "todo", label: "To Do" },
  { value: "inProgress", label: "In Progress" },
  { value: "complete", label: "Complete" },
] as const;

// Default choices for a new status property, one per category.
export function defaultStatusChoices(): Choice[] {
  return [
    { id: generateBaseChoiceId(), name: "Not started", color: "gray", category: "todo" },
    { id: generateBaseChoiceId(), name: "In progress", color: "blue", category: "inProgress" },
    { id: generateBaseChoiceId(), name: "Done", color: "green", category: "complete" },
  ];
}

function pruneDefault(
  value: string | string[] | null,
  choices: Choice[],
): string | string[] | null {
  if (value === null) return null;
  const ids = new Set(choices.map((c) => c.id));
  if (Array.isArray(value)) {
    const live = value.filter((id) => ids.has(id));
    return live.length ? live : null;
  }
  return ids.has(value) ? value : null;
}

function defaultsEqual(
  a: string | string[] | null,
  b: string | string[] | null,
): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => v === b[i]);
  }
  return a === b;
}

type ChoiceEditorProps = {
  initialChoices: Choice[];
  onSave: (choices: Choice[], defaultValue: string | string[] | null) => void;
  onClose: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  showCategories?: boolean;
  hideButtons?: boolean;
  initialDefaultValue?: string | string[] | null;
  multiDefault?: boolean;
  /**
   * Where the per-choice color-picker popover portals. Pass the enclosing
   * property-menu dropdown node so the picker renders INSIDE that subtree —
   * otherwise a color click registers as "outside" and closes the menu.
   */
  dropdownPortalTarget?: HTMLElement | null;
};

export function ChoiceEditor({
  initialChoices,
  onSave,
  onClose,
  onDirtyChange,
  showCategories = false,
  hideButtons = false,
  initialDefaultValue = null,
  multiDefault = false,
  dropdownPortalTarget,
}: ChoiceEditorProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<Choice[]>(initialChoices);
  const [focusChoiceId, setFocusChoiceId] = useState<string | null>(null);
  const [defaultDraft, setDefaultDraft] = useState<string | string[] | null>(
    initialDefaultValue,
  );

  useEffect(() => {
    if (!hideButtons) {
      setDraft(initialChoices);
      setDefaultDraft(initialDefaultValue);
    }
  }, [initialChoices, initialDefaultValue, hideButtons]);

  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  useEffect(() => {
    if (hideButtons) {
      const cleaned = draft.filter((c) => c.name.trim());
      onSaveRef.current(cleaned, pruneDefault(defaultDraft, cleaned));
    }
  }, [hideButtons, draft, defaultDraft]);

  const isDirty = useMemo(() => {
    if (!defaultsEqual(defaultDraft, initialDefaultValue)) return true;
    if (draft.length !== initialChoices.length) return true;
    return draft.some((d, i) => {
      const o = initialChoices[i];
      return d.id !== o.id || d.name !== o.name || d.color !== o.color || d.category !== o.category;
    });
  }, [draft, initialChoices, defaultDraft, initialDefaultValue]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const hasEmptyNames = draft.some((c) => !c.name.trim());

  const handleRename = useCallback((choiceId: string, name: string) => {
    setDraft((prev) => prev.map((c) => (c.id === choiceId ? { ...c, name } : c)));
  }, []);

  const handleColorChange = useCallback((choiceId: string, color: string) => {
    setDraft((prev) => prev.map((c) => (c.id === choiceId ? { ...c, color } : c)));
  }, []);

  const handleRemove = useCallback((choiceId: string) => {
    setDraft((prev) => prev.filter((c) => c.id !== choiceId));
    setDefaultDraft((prev) => {
      if (prev === null) return prev;
      if (Array.isArray(prev)) {
        const next = prev.filter((id) => id !== choiceId);
        return next.length ? next : null;
      }
      return prev === choiceId ? null : prev;
    });
  }, []);

  const handleAdd = useCallback((category?: "todo" | "inProgress" | "complete") => {
    const id = generateBaseChoiceId();
    setDraft((prev) => {
      const colorIndex = prev.length % CHOICE_COLORS.length;
      const newChoice: Choice = {
        id,
        name: "",
        color: CHOICE_COLORS[colorIndex],
        ...(category ? { category } : {}),
      };
      return [...prev, newChoice];
    });
    setFocusChoiceId(id);
  }, []);

  const handleAlphabetize = useCallback(() => {
    setDraft((prev) => [...prev].sort((a, b) => a.name.localeCompare(b.name)));
  }, []);

  const handleSave = useCallback(() => {
    const cleaned = draft.filter((c) => c.name.trim());
    onSave(cleaned, pruneDefault(defaultDraft, cleaned));
    onClose();
  }, [draft, defaultDraft, onSave, onClose]);

  const handleCancel = useCallback(() => {
    setDraft(initialChoices);
    setDefaultDraft(initialDefaultValue);
    onDirtyChange?.(false);
    onClose();
  }, [initialChoices, initialDefaultValue, onDirtyChange, onClose]);

  const handleReorder = useCallback(
    (activeId: string, targetId: string, edge: Edge) => {
      setDraft((prev) => {
        const startIndex = prev.findIndex((c) => c.id === activeId);
        const indexOfTarget = prev.findIndex((c) => c.id === targetId);
        if (startIndex === -1 || indexOfTarget === -1) return prev;
        const finishIndex = getReorderDestinationIndex({
          startIndex,
          indexOfTarget,
          closestEdgeOfTarget: edge,
          axis: "vertical",
        });
        if (finishIndex === startIndex) return prev;
        return reorder({ list: prev, startIndex, finishIndex });
      });
    },
    [],
  );

  const handleCategoryReorder = useCallback(
    (category: string, activeId: string, targetId: string, edge: Edge) => {
      setDraft((prev) => {
        const catChoices = prev.filter((c) => (c.category ?? "todo") === category);
        const startIndex = catChoices.findIndex((c) => c.id === activeId);
        const indexOfTarget = catChoices.findIndex((c) => c.id === targetId);
        if (startIndex === -1 || indexOfTarget === -1) return prev;
        const finishIndex = getReorderDestinationIndex({
          startIndex,
          indexOfTarget,
          closestEdgeOfTarget: edge,
          axis: "vertical",
        });
        if (finishIndex === startIndex) return prev;
        const reordered = reorder({
          list: catChoices,
          startIndex,
          finishIndex,
        });
        const result: Choice[] = [];
        for (const cat of ["todo", "inProgress", "complete"]) {
          if (cat === category) {
            result.push(...reordered);
          } else {
            result.push(...prev.filter((c) => (c.category ?? "todo") === cat));
          }
        }
        return result;
      });
    },
    [],
  );

  return (
    <Stack gap="xs">
      <Group justify="space-between">
        <Text size="xs" fw={600}>
          {t("Options")}
        </Text>
        <UnstyledButton onClick={handleAlphabetize} className={classes.alphabetizeBtn}>
          <IconArrowsSort size={14} color="var(--mantine-color-dimmed)" />
          <Text size="xs" c="dimmed">{t("Alphabetize")}</Text>
        </UnstyledButton>
      </Group>

      {showCategories ? (
        <StatusChoiceList
          draft={draft}
          focusChoiceId={focusChoiceId}
          onFocused={() => setFocusChoiceId(null)}
          onRename={handleRename}
          onColorChange={handleColorChange}
          onRemove={handleRemove}
          onAdd={handleAdd}
          onCategoryReorder={handleCategoryReorder}
          dropdownPortalTarget={dropdownPortalTarget}
        />
      ) : (
        <FlatChoiceList
          draft={draft}
          focusChoiceId={focusChoiceId}
          onFocused={() => setFocusChoiceId(null)}
          onRename={handleRename}
          onColorChange={handleColorChange}
          onRemove={handleRemove}
          onAdd={handleAdd}
          onReorder={handleReorder}
          dropdownPortalTarget={dropdownPortalTarget}
        />
      )}

      <DefaultValuePicker
        choices={draft.filter((c) => c.name.trim())}
        value={defaultDraft}
        multiple={multiDefault}
        onChange={setDefaultDraft}
        dropdownPortalTarget={dropdownPortalTarget}
      />

      {!hideButtons && (
        <>
          <Divider />

          <Group justify="flex-end" gap="xs">
            <Button variant="default" size="xs" onClick={handleCancel}>
              {t("Cancel")}
            </Button>
            <Button size="xs" onClick={handleSave} disabled={!isDirty || hasEmptyNames}>
              {t("Save")}
            </Button>
          </Group>
        </>
      )}
    </Stack>
  );
}

function FlatChoiceList({
  draft,
  focusChoiceId,
  onFocused,
  onRename,
  onColorChange,
  onRemove,
  onAdd,
  onReorder,
  dropdownPortalTarget,
}: {
  draft: Choice[];
  focusChoiceId: string | null;
  onFocused: () => void;
  onRename: (id: string, name: string) => void;
  onColorChange: (id: string, color: string) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
  onReorder: (activeId: string, targetId: string, edge: Edge) => void;
  dropdownPortalTarget?: HTMLElement | null;
}) {
  const { t } = useTranslation();

  return (
    <Stack gap={4}>
      {draft.map((choice) => (
        <SortableChoiceRow
          key={choice.id}
          choice={choice}
          dragType="base-choice-flat"
          autoFocus={choice.id === focusChoiceId}
          onFocused={onFocused}
          onRename={onRename}
          onColorChange={onColorChange}
          onRemove={onRemove}
          onReorder={onReorder}
          dropdownPortalTarget={dropdownPortalTarget}
        />
      ))}

      <UnstyledButton
        onClick={() => onAdd()}
        className={classes.addOptionBtn}
      >
        <IconPlus size={14} color="var(--mantine-color-dimmed)" />
        <Text size="xs" c="dimmed">{t("Add option")}</Text>
      </UnstyledButton>
    </Stack>
  );
}

function StatusChoiceList({
  draft,
  focusChoiceId,
  onFocused,
  onRename,
  onColorChange,
  onRemove,
  onAdd,
  onCategoryReorder,
  dropdownPortalTarget,
}: {
  draft: Choice[];
  focusChoiceId: string | null;
  onFocused: () => void;
  onRename: (id: string, name: string) => void;
  onColorChange: (id: string, color: string) => void;
  onRemove: (id: string) => void;
  onAdd: (category: "todo" | "inProgress" | "complete") => void;
  onCategoryReorder: (category: string, activeId: string, targetId: string, edge: Edge) => void;
  dropdownPortalTarget?: HTMLElement | null;
}) {
  const grouped = useMemo(() => {
    const groups: Record<string, Choice[]> = { todo: [], inProgress: [], complete: [] };
    for (const choice of draft) {
      const cat = choice.category ?? "todo";
      (groups[cat] ?? groups.todo).push(choice);
    }
    return groups;
  }, [draft]);

  return (
    <Stack gap="sm">
      {STATUS_CATEGORIES.map(({ value: category, label }) => (
        <CategorySection
          key={category}
          category={category as "todo" | "inProgress" | "complete"}
          label={label}
          choices={grouped[category] ?? []}
          focusChoiceId={focusChoiceId}
          onFocused={onFocused}
          onRename={onRename}
          onColorChange={onColorChange}
          onRemove={onRemove}
          onAdd={onAdd}
          onReorder={onCategoryReorder}
          dropdownPortalTarget={dropdownPortalTarget}
        />
      ))}
    </Stack>
  );
}

function CategorySection({
  category,
  label,
  choices,
  focusChoiceId,
  onFocused,
  onRename,
  onColorChange,
  onRemove,
  onAdd,
  onReorder,
  dropdownPortalTarget,
}: {
  category: "todo" | "inProgress" | "complete";
  label: string;
  choices: Choice[];
  focusChoiceId: string | null;
  onFocused: () => void;
  onRename: (id: string, name: string) => void;
  onColorChange: (id: string, color: string) => void;
  onRemove: (id: string) => void;
  onAdd: (category: "todo" | "inProgress" | "complete") => void;
  onReorder: (
    category: string,
    activeId: string,
    targetId: string,
    edge: Edge,
  ) => void;
  dropdownPortalTarget?: HTMLElement | null;
}) {
  const { t } = useTranslation();

  const handleRowReorder = useCallback(
    (activeId: string, targetId: string, edge: Edge) => {
      onReorder(category, activeId, targetId, edge);
    },
    [category, onReorder],
  );

  return (
    <Stack gap={4}>
      <Text size="xs" fw={600} c="dimmed">
        {t(label)}
      </Text>

      {choices.map((choice) => (
        <SortableChoiceRow
          key={choice.id}
          choice={choice}
          // Per-category drag type prevents cross-category drops.
          dragType={`base-choice-status:${category}`}
          autoFocus={choice.id === focusChoiceId}
          onFocused={onFocused}
          onRename={onRename}
          onColorChange={onColorChange}
          onRemove={onRemove}
          onReorder={handleRowReorder}
          dropdownPortalTarget={dropdownPortalTarget}
        />
      ))}

      <UnstyledButton
        onClick={() => onAdd(category)}
        className={classes.addOptionBtn}
      >
        <IconPlus size={14} color="var(--mantine-color-dimmed)" />
        <Text size="xs" c="dimmed">{t("Add option")}</Text>
      </UnstyledButton>
    </Stack>
  );
}

function SortableChoiceRow({
  choice,
  dragType,
  autoFocus,
  onFocused,
  onRename,
  onColorChange,
  onRemove,
  onReorder,
  dropdownPortalTarget,
}: {
  choice: Choice;
  dragType: string;
  autoFocus?: boolean;
  onFocused?: () => void;
  onRename: (id: string, name: string) => void;
  onColorChange: (id: string, color: string) => void;
  onRemove: (id: string) => void;
  onReorder: (activeId: string, targetId: string, edge: Edge) => void;
  dropdownPortalTarget?: HTMLElement | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [closestEdge, setClosestEdge] = useState<Edge | null>(null);

  // Stable ref so the DnD effect doesn't re-register on every parent render.
  const onReorderRef = useRef(onReorder);
  useLayoutEffect(() => {
    onReorderRef.current = onReorder;
  });

  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus();
      onFocused?.();
    }
  }, [autoFocus, onFocused]);

  useEffect(() => {
    const row = rowRef.current;
    const handle = handleRef.current;
    if (!row || !handle) return;
    return combine(
      draggable({
        element: row,
        dragHandle: handle,
        getInitialData: () => ({ type: dragType, choiceId: choice.id }),
        onDragStart: () => setIsDragging(true),
        onDrop: () => setIsDragging(false),
      }),
      dropTargetForElements({
        element: row,
        canDrop: ({ source }) =>
          source.data.type === dragType &&
          source.data.choiceId !== choice.id,
        getData: ({ input, element }) =>
          attachClosestEdge(
            { choiceId: choice.id },
            { input, element, allowedEdges: ["top", "bottom"] },
          ),
        onDrag: ({ self }) => setClosestEdge(extractClosestEdge(self.data)),
        onDragLeave: () => setClosestEdge(null),
        onDrop: ({ source, self }) => {
          setClosestEdge(null);
          const edge = extractClosestEdge(self.data);
          if (!edge) return;
          onReorderRef.current(
            source.data.choiceId as string,
            choice.id,
            edge,
          );
          triggerPostMoveFlash(row);
          liveRegion.announce("Moved option");
        },
      }),
    );
  }, [choice.id, dragType]);

  const hasError = !choice.name.trim();

  return (
    <Group
      ref={rowRef}
      gap={6}
      wrap="nowrap"
      align="center"
      style={{
        position: "relative",
        opacity: isDragging ? 0.4 : 1,
      }}
      data-dragging={isDragging || undefined}
    >
      <div ref={handleRef} className={classes.dragHandle}>
        <IconGripVertical size={14} style={{ opacity: 0.4 }} />
      </div>
      <ColorDot
        color={choice.color}
        onChange={(c) => onColorChange(choice.id, c)}
        dropdownPortalTarget={dropdownPortalTarget}
      />
      <TextInput
        ref={inputRef}
        size="xs"
        value={choice.name}
        onChange={(e) => onRename(choice.id, e.currentTarget.value)}
        style={{ flex: 1 }}
        error={hasError}
        styles={hasError ? { input: { borderColor: "var(--mantine-color-red-6)" } } : undefined}
      />
      <CloseButton size="sm" onClick={() => onRemove(choice.id)} />
      {closestEdge && <BaseDropEdgeIndicator edge={closestEdge} />}
    </Group>
  );
}

function ColorDot({
  color,
  onChange,
  dropdownPortalTarget,
}: {
  color: string;
  onChange: (color: string) => void;
  dropdownPortalTarget?: HTMLElement | null;
}) {
  const [opened, setOpened] = useState(false);
  const colors = choiceColor(color);

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      position="bottom"
      shadow="sm"
      withinPortal
      portalProps={{ target: dropdownPortalTarget ?? undefined }}
    >
      <Popover.Target>
        <UnstyledButton
          onClick={() => setOpened((o) => !o)}
          style={{
            width: 20,
            height: 20,
            borderRadius: "50%",
            backgroundColor: colors.backgroundColor as string,
            border: `2px solid ${colors.color as string}`,
            flexShrink: 0,
          }}
        />
      </Popover.Target>
      <Popover.Dropdown p={8}>
        <SimpleGrid cols={5} spacing={6}>
          {CHOICE_COLORS.map((c) => {
            const dotColors = choiceColor(c);
            return (
              <UnstyledButton
                key={c}
                onClick={() => {
                  onChange(c);
                  setOpened(false);
                }}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  backgroundColor: dotColors.backgroundColor as string,
                  border: c === color
                    ? `2px solid ${dotColors.color as string}`
                    : "2px solid transparent",
                }}
              />
            );
          })}
        </SimpleGrid>
      </Popover.Dropdown>
    </Popover>
  );
}
