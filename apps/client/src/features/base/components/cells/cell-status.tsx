import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Popover, TextInput } from "@mantine/core";
import {
  IBaseProperty,
  SelectTypeOptions,
  Choice,
} from "@/features/base/types/base.types";
import { choiceColor } from "@/features/base/components/cells/choice-color";
import cellClasses from "@/features/base/styles/cells.module.css";
import clsx from "clsx";
import { useListKeyboardNav } from "@/features/base/hooks/use-list-keyboard-nav";

type CellStatusProps = {
  value: unknown;
  property: IBaseProperty;
  rowId: string;
  isEditing: boolean;
  onCommit: (value: unknown) => void;
  onCancel: () => void;
};

type CategoryGroup = {
  label: string;
  choices: Choice[];
};

const categoryLabels: Record<string, string> = {
  todo: "To Do",
  inProgress: "In Progress",
  complete: "Complete",
};

export function CellStatus({
  value,
  property,
  isEditing,
  onCommit,
  onCancel,
}: CellStatusProps) {
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

  const groups = useMemo(() => {
    const filtered = search
      ? choices.filter((c) =>
          c.name.toLowerCase().includes(search.toLowerCase()),
        )
      : choices;

    const grouped: Record<string, Choice[]> = {};
    for (const choice of filtered) {
      const cat = choice.category ?? "todo";
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(choice);
    }

    const result: CategoryGroup[] = [];
    for (const key of ["todo", "inProgress", "complete"]) {
      if (grouped[key]?.length) {
        result.push({ label: categoryLabels[key] ?? key, choices: grouped[key] });
      }
    }
    return result;
  }, [choices, search]);

  const flatChoices = useMemo(
    () => groups.flatMap((g) => g.choices),
    [groups],
  );
  const choiceIdxMap = useMemo(() => {
    const m = new Map<string, number>();
    flatChoices.forEach((c, i) => m.set(c.id, i));
    return m;
  }, [flatChoices]);

  const { activeIndex, setActiveIndex, handleNavKey, setOptionRef } =
    useListKeyboardNav(flatChoices.length, [search, isEditing]);

  const handleSelect = useCallback(
    (choice: Choice) => {
      onCommit(choice.id === selectedId ? null : choice.id);
    },
    [selectedId, onCommit],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
        return;
      }
      if (handleNavKey(e)) return;
      if (e.key === "Enter") {
        if (activeIndex < 0 || activeIndex >= flatChoices.length) return;
        e.preventDefault();
        handleSelect(flatChoices[activeIndex]);
      }
    },
    [onCancel, handleNavKey, activeIndex, flatChoices, handleSelect],
  );

  if (isEditing) {
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
            {groups.map((group) => (
              <div key={group.label}>
                <div className={cellClasses.selectCategoryLabel}>
                  {group.label}
                </div>
                {group.choices.map((choice) => {
                  const idx = choiceIdxMap.get(choice.id) ?? -1;
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
                      onMouseDown={(e) => {
                        e.preventDefault();
                      }}
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
              </div>
            ))}
          </div>
        </Popover.Dropdown>
      </Popover>
    );
  }

  if (!selectedChoice) {
    return <span className={cellClasses.emptyValue} />;
  }

  return (
    <span
      className={cellClasses.badge}
      style={choiceColor(selectedChoice.color)}
    >
      {selectedChoice.name}
    </span>
  );
}
