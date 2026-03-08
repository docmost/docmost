import { useState, useRef, useEffect, useCallback } from "react";
import { Popover, TextInput } from "@mantine/core";
import {
  IBaseProperty,
  SelectTypeOptions,
  Choice,
} from "@/features/base/types/base.types";
import { choiceColor } from "@/features/base/components/cells/choice-color";
import cellClasses from "@/features/base/styles/cells.module.css";

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

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    },
    [onCancel],
  );

  const MAX_VISIBLE = 3;

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
            {filteredChoices.map((choice) => (
              <div
                key={choice.id}
                className={`${cellClasses.selectOption} ${
                  selectedSet.has(choice.id)
                    ? cellClasses.selectOptionActive
                    : ""
                }`}
                onClick={() => handleToggle(choice)}
              >
                <span
                  className={cellClasses.badge}
                  style={choiceColor(choice.color)}
                >
                  {choice.name}
                </span>
              </div>
            ))}
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
