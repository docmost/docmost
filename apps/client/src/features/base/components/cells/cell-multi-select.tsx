import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Popover, TextInput } from "@mantine/core";
import clsx from "clsx";
import {
  IBaseProperty,
  SelectTypeOptions,
  Choice,
} from "@/features/base/types/base.types";
import { choiceColor } from "@/features/base/components/cells/choice-color";
import { useUpdatePropertyMutation } from "@/features/base/queries/base-property-query";
import { v7 as uuid7 } from "uuid";
import cellClasses from "@/features/base/styles/cells.module.css";
import { useListKeyboardNav } from "@/features/base/hooks/use-list-keyboard-nav";

const CHOICE_COLORS = [
  "gray", "red", "pink", "grape", "violet", "indigo",
  "blue", "cyan", "teal", "green", "lime", "yellow", "orange",
];

type NavItem =
  | { kind: "choice"; choice: Choice }
  | { kind: "add" };

type CellMultiSelectProps = {
  value: unknown;
  property: IBaseProperty;
  rowId: string;
  isEditing: boolean;
  onCommit: (value: unknown) => void;
  onCancel: () => void;
};

export function CellMultiSelect({
  value,
  property,
  isEditing,
  onCommit,
  onCancel,
}: CellMultiSelectProps) {
  const typeOptions = property.typeOptions as SelectTypeOptions | undefined;
  const choices = typeOptions?.choices ?? [];
  const selectedIds = Array.isArray(value) ? (value as string[]) : [];
  const selectedSet = new Set(selectedIds);

  const selectedChoices = choices.filter((c) => selectedSet.has(c.id));

  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      setSearch("");
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [isEditing]);

  const filteredChoices = search
    ? choices.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    : choices;

  const handleToggle = useCallback(
    (choice: Choice) => {
      const newIds = selectedSet.has(choice.id)
        ? selectedIds.filter((id) => id !== choice.id)
        : [...selectedIds, choice.id];
      onCommit(newIds);
    },
    [selectedIds, selectedSet, onCommit],
  );

  const updatePropertyMutation = useUpdatePropertyMutation();

  const trimmedSearch = search.trim();
  const hasExactMatch = useMemo(
    () =>
      trimmedSearch.length > 0 &&
      choices.some((c) => c.name.toLowerCase() === trimmedSearch.toLowerCase()),
    [choices, trimmedSearch],
  );
  const showAddOption = trimmedSearch.length > 0 && !hasExactMatch;

  const addOptionColor = useMemo(
    () => CHOICE_COLORS[choices.length % CHOICE_COLORS.length],
    [choices.length],
  );

  const navItems = useMemo<NavItem[]>(
    () => [
      ...filteredChoices.map((c) => ({ kind: "choice" as const, choice: c })),
      ...(showAddOption ? [{ kind: "add" as const }] : []),
    ],
    [filteredChoices, showAddOption],
  );

  const { activeIndex, setActiveIndex, handleNavKey, setOptionRef } =
    useListKeyboardNav(navItems.length, [search, isEditing, showAddOption]);

  const handleAddOption = useCallback(() => {
    if (!trimmedSearch) return;
    const newChoice: Choice = {
      id: uuid7(),
      name: trimmedSearch,
      color: addOptionColor,
    };
    const newChoices = [...choices, newChoice];
    updatePropertyMutation.mutate({
      propertyId: property.id,
      baseId: property.baseId,
      typeOptions: {
        ...typeOptions,
        choices: newChoices,
        choiceOrder: newChoices.map((c) => c.id),
      },
    });
    onCommit([...selectedIds, newChoice.id]);
    setSearch("");
  }, [trimmedSearch, addOptionColor, choices, typeOptions, property, updatePropertyMutation, selectedIds, onCommit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
        return;
      }
      if (handleNavKey(e)) return;
      if (e.key === "Enter") {
        if (activeIndex >= 0 && activeIndex < navItems.length) {
          e.preventDefault();
          const item = navItems[activeIndex];
          if (item.kind === "choice") handleToggle(item.choice);
          else handleAddOption();
          return;
        }
        if (showAddOption) {
          e.preventDefault();
          handleAddOption();
        }
      }
    },
    [onCancel, handleNavKey, activeIndex, navItems, handleToggle, handleAddOption, showAddOption],
  );

  const MAX_VISIBLE = 3;

  if (isEditing) {
    const addOptionIdx = filteredChoices.length;
    return (
      <Popover
        opened
        onClose={onCancel}
        position="bottom-start"
        width={220}
        trapFocus
      >
        <Popover.Target>
          <div style={{ width: "100%", height: "100%" }}>
            <BadgeList choices={selectedChoices} maxVisible={MAX_VISIBLE} />
          </div>
        </Popover.Target>
        <Popover.Dropdown p={4}>
          <TextInput
            ref={searchRef}
            size="xs"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
            mb={4}
          />
          <div className={cellClasses.selectDropdown}>
            {filteredChoices.map((choice, idx) => {
              const isSelected = selectedSet.has(choice.id);
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
                  onMouseDown={(e) => {
                    // Keep focus on the search input so click doesn't blur + close popover.
                    e.preventDefault();
                  }}
                  onClick={() => handleToggle(choice)}
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
            {showAddOption && (
              <div
                ref={setOptionRef(addOptionIdx)}
                className={clsx(
                  cellClasses.addOptionRow,
                  addOptionIdx === activeIndex && cellClasses.selectOptionKeyboardActive,
                )}
                onMouseEnter={() => setActiveIndex(addOptionIdx)}
                onMouseDown={(e) => {
                  e.preventDefault();
                }}
                onClick={handleAddOption}
              >
                <span className={cellClasses.addOptionLabel}>Add option:</span>
                <span
                  className={cellClasses.badge}
                  style={choiceColor(addOptionColor)}
                >
                  {trimmedSearch}
                </span>
              </div>
            )}
          </div>
        </Popover.Dropdown>
      </Popover>
    );
  }

  if (selectedChoices.length === 0) {
    return <span className={cellClasses.emptyValue} />;
  }

  return <BadgeList choices={selectedChoices} maxVisible={MAX_VISIBLE} />;
}

function BadgeList({
  choices,
  maxVisible,
}: {
  choices: Choice[];
  maxVisible: number;
}) {
  const visible = choices.slice(0, maxVisible);
  const overflow = choices.length - maxVisible;

  return (
    <div className={cellClasses.badgeGroup}>
      {visible.map((choice) => (
        <span
          key={choice.id}
          className={cellClasses.badge}
          style={choiceColor(choice.color)}
        >
          {choice.name}
        </span>
      ))}
      {overflow > 0 && (
        <span className={cellClasses.overflowCount}>+{overflow}</span>
      )}
    </div>
  );
}
