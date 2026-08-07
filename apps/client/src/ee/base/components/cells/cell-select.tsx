import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Popover, TextInput } from "@mantine/core";
import clsx from "clsx";
import {
  IBaseProperty,
  SelectTypeOptions,
  Choice,
} from "@/ee/base/types/base.types";
import { choiceColor } from "@/ee/base/components/cells/choice-color";
import { ChoiceBadge } from "@/ee/base/components/cells/choice-badge";
import { useUpdatePropertyMutation } from "@/ee/base/queries/base-property-query";
import { generateBaseChoiceId } from "@/ee/base/utils/generate-base-id";
import cellClasses from "@/ee/base/styles/cells.module.css";
import { useListKeyboardNav } from "@/ee/base/hooks/use-list-keyboard-nav";

const CHOICE_COLORS = [
  "gray", "red", "pink", "grape", "violet", "indigo",
  "blue", "cyan", "teal", "green", "lime", "yellow", "orange",
];

type NavItem =
  | { kind: "choice"; choice: Choice }
  | { kind: "add" };

type CellSelectProps = {
  value: unknown;
  property: IBaseProperty;
  rowId: string;
  isEditing: boolean;
  onCommit: (value: unknown) => void;
  onCancel: () => void;
};

export function CellSelect({
  value,
  property,
  isEditing,
  onCommit,
  onCancel,
}: CellSelectProps) {
  const typeOptions = property.typeOptions as SelectTypeOptions | undefined;
  const choices = typeOptions?.choices ?? [];
  const selectedId = typeof value === "string" ? value : null;
  const selectedChoice = choices.find((c) => c.id === selectedId);

  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      setSearch("");
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [isEditing]);

  const filteredChoices = search
    ? choices.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase()),
      )
    : choices;

  const handleSelect = useCallback(
    (choice: Choice) => {
      onCommit(choice.id === selectedId ? null : choice.id);
    },
    [selectedId, onCommit],
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
    onCommit(newChoice.id);
  }, [trimmedSearch, addOptionColor, choices, typeOptions, property, updatePropertyMutation, onCommit]);

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
          if (item.kind === "choice") handleSelect(item.choice);
          else handleAddOption();
          return;
        }
        if (showAddOption) {
          e.preventDefault();
          handleAddOption();
        }
      }
    },
    [onCancel, handleNavKey, activeIndex, navItems, handleSelect, handleAddOption, showAddOption],
  );

  if (isEditing) {
    const addOptionIdx = filteredChoices.length;
    return (
      <Popover
        opened
        onChange={(o) => {
          if (!o) onCancel();
        }}
        onClose={onCancel}
        position="bottom-start"
        width={220}
        trapFocus
        closeOnClickOutside
        closeOnEscape
      >
        <Popover.Target>
          <div className={cellClasses.popoverTarget}>
            {selectedChoice ? (
              <span
                className={cellClasses.badge}
                style={choiceColor(selectedChoice.color)}
              >
                {selectedChoice.name}
              </span>
            ) : (
              <span className={cellClasses.emptyValue} />
            )}
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
              const isSelected = choice.id === selectedId;
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
                  onClick={() => handleSelect(choice)}
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

  if (!selectedChoice) {
    return <span className={cellClasses.emptyValue} />;
  }

  return (
    <ChoiceBadge
      name={selectedChoice.name}
      style={choiceColor(selectedChoice.color)}
    />
  );
}
