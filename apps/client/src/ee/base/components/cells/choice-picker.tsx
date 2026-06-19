import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { TextInput } from "@mantine/core";
import { IconX } from "@tabler/icons-react";
import clsx from "clsx";
import {
  IBaseProperty,
  SelectTypeOptions,
  Choice,
} from "@/ee/base/types/base.types";
import { choiceColor } from "@/ee/base/components/cells/choice-color";
import { useUpdatePropertyMutation } from "@/ee/base/queries/base-property-query";
import { generateBaseChoiceId } from "@/ee/base/utils/generate-base-id";
import { useListKeyboardNav } from "@/ee/base/hooks/use-list-keyboard-nav";
import cellClasses from "@/ee/base/styles/cells.module.css";

const CHOICE_COLORS = [
  "gray", "red", "pink", "grape", "violet", "indigo",
  "blue", "cyan", "teal", "green", "lime", "yellow", "orange",
];

const STATUS_CATEGORY_LABELS: Record<string, string> = {
  todo: "To Do",
  inProgress: "In Progress",
  complete: "Complete",
};
const STATUS_CATEGORY_ORDER = ["todo", "inProgress", "complete"];

type NavItem =
  | { kind: "choice"; choice: Choice }
  | { kind: "add" };

type ChoiceGroup = { label: string | null; choices: Choice[] };

type ChoicePickerProps = {
  property: IBaseProperty;
  selectedIds: string[];
  /** Multi keeps the picker open, hides picked options from the list and
   *  shows them as removable tags instead. */
  multiple?: boolean;
  /** Group options under status category headings. */
  grouped?: boolean;
  /** Offer "Add option: <search>" when the search has no exact match. */
  allowCreate?: boolean;
  onToggle: (choice: Choice) => void;
  onEscape: () => void;
};

/** Searchable choice list shared by select-like editors (modal fields; the
 *  grid cells render the same UI and can migrate here). */
export function ChoicePicker({
  property,
  selectedIds,
  multiple = false,
  grouped = false,
  allowCreate = false,
  onToggle,
  onEscape,
}: ChoicePickerProps) {
  const typeOptions = property.typeOptions as SelectTypeOptions | undefined;
  const choices = typeOptions?.choices ?? [];
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedChoices = choices.filter((c) => selectedSet.has(c.id));

  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => searchRef.current?.focus());
  }, []);

  const groups = useMemo<ChoiceGroup[]>(() => {
    const filtered = (
      search
        ? choices.filter((c) =>
            c.name.toLowerCase().includes(search.toLowerCase()),
          )
        : choices
    ).filter((c) => !multiple || !selectedSet.has(c.id));

    if (!grouped) return [{ label: null, choices: filtered }];

    const byCategory: Record<string, Choice[]> = {};
    for (const choice of filtered) {
      const cat = choice.category ?? "todo";
      (byCategory[cat] ??= []).push(choice);
    }
    return STATUS_CATEGORY_ORDER.filter((key) => byCategory[key]?.length).map(
      (key) => ({ label: STATUS_CATEGORY_LABELS[key] ?? key, choices: byCategory[key] }),
    );
  }, [choices, search, grouped, multiple, selectedSet]);

  const flatChoices = useMemo(() => groups.flatMap((g) => g.choices), [groups]);
  const choiceIdxMap = useMemo(() => {
    const m = new Map<string, number>();
    flatChoices.forEach((c, i) => m.set(c.id, i));
    return m;
  }, [flatChoices]);

  const updatePropertyMutation = useUpdatePropertyMutation();
  const trimmedSearch = search.trim();
  const hasExactMatch = useMemo(
    () =>
      trimmedSearch.length > 0 &&
      choices.some((c) => c.name.toLowerCase() === trimmedSearch.toLowerCase()),
    [choices, trimmedSearch],
  );
  const showAddOption = allowCreate && trimmedSearch.length > 0 && !hasExactMatch;
  const addOptionColor = useMemo(
    () => CHOICE_COLORS[choices.length % CHOICE_COLORS.length],
    [choices.length],
  );

  const navItems = useMemo<NavItem[]>(
    () => [
      ...flatChoices.map((c) => ({ kind: "choice" as const, choice: c })),
      ...(showAddOption ? [{ kind: "add" as const }] : []),
    ],
    [flatChoices, showAddOption],
  );

  const { activeIndex, setActiveIndex, handleNavKey, setOptionRef } =
    useListKeyboardNav(navItems.length, [search, showAddOption]);

  const handleAddOption = useCallback(() => {
    if (!trimmedSearch) return;
    const newChoice: Choice = {
      id: generateBaseChoiceId(),
      name: trimmedSearch,
      color: addOptionColor,
    };
    const newChoices = [...choices, newChoice];
    updatePropertyMutation.mutate({
      propertyId: property.id,
      pageId: property.pageId,
      typeOptions: {
        ...typeOptions,
        choices: newChoices,
        choiceOrder: newChoices.map((c) => c.id),
      },
    });
    onToggle(newChoice);
    setSearch("");
  }, [trimmedSearch, addOptionColor, choices, typeOptions, property, updatePropertyMutation, onToggle]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onEscape();
        return;
      }
      if (handleNavKey(e)) return;
      if (e.key === "Enter") {
        if (activeIndex >= 0 && activeIndex < navItems.length) {
          e.preventDefault();
          const item = navItems[activeIndex];
          if (item.kind === "choice") onToggle(item.choice);
          else handleAddOption();
          return;
        }
        if (showAddOption) {
          e.preventDefault();
          handleAddOption();
        }
      }
    },
    [onEscape, handleNavKey, activeIndex, navItems, onToggle, handleAddOption, showAddOption],
  );

  const addOptionIdx = flatChoices.length;

  return (
    <>
      {multiple && selectedChoices.length > 0 && (
        <div className={cellClasses.personTagArea}>
          {selectedChoices.map((choice) => (
            <span
              key={choice.id}
              className={cellClasses.badge}
              style={choiceColor(choice.color)}
            >
              {choice.name}
              <button
                type="button"
                className={`${cellClasses.personTagRemove} ${cellClasses.badgeRemoveBtn}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggle(choice);
                }}
              >
                <IconX size={10} />
              </button>
            </span>
          ))}
        </div>
      )}
      <TextInput
        ref={searchRef}
        size="xs"
        placeholder="Search..."
        value={search}
        onChange={(e) => setSearch(e.currentTarget.value)}
        onKeyDown={handleKeyDown}
        mb={4}
        data-autofocus
      />
      <div className={cellClasses.selectDropdown}>
        {groups.map((group) => (
          <div key={group.label ?? "all"}>
            {group.label && (
              <div className={cellClasses.selectCategoryLabel}>{group.label}</div>
            )}
            {group.choices.map((choice) => {
              const idx = choiceIdxMap.get(choice.id) ?? -1;
              const isSelected = !multiple && selectedSet.has(choice.id);
              return (
                <div
                  key={choice.id}
                  ref={setOptionRef(idx)}
                  className={clsx(
                    cellClasses.selectOption,
                    isSelected && cellClasses.selectOptionActive,
                    idx === activeIndex && cellClasses.selectOptionKeyboardActive,
                  )}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => onToggle(choice)}
                >
                  <span
                    className={cellClasses.badge}
                    style={choiceColor(choice.color)}
                  >
                    {choice.name}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
        {showAddOption && (
          <div
            ref={setOptionRef(addOptionIdx)}
            className={clsx(
              cellClasses.addOptionRow,
              addOptionIdx === activeIndex && cellClasses.selectOptionKeyboardActive,
            )}
            onMouseEnter={() => setActiveIndex(addOptionIdx)}
            onClick={handleAddOption}
          >
            <span className={cellClasses.addOptionLabel}>Add option:</span>
            <span className={cellClasses.badge} style={choiceColor(addOptionColor)}>
              {trimmedSearch}
            </span>
          </div>
        )}
      </div>
    </>
  );
}
