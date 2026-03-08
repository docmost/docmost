import { useState, useRef, useEffect, useCallback } from "react";
import { Popover, TextInput } from "@mantine/core";
import {
  IBaseProperty,
  SelectTypeOptions,
  Choice,
} from "@/features/base/types/base.types";
import { choiceColor } from "@/features/base/components/cells/choice-color";
import cellClasses from "@/features/base/styles/cells.module.css";

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

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    },
    [onCancel],
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
            {filteredChoices.map((choice) => (
              <div
                key={choice.id}
                className={`${cellClasses.selectOption} ${
                  choice.id === selectedId ? cellClasses.selectOptionActive : ""
                }`}
                onClick={() => handleSelect(choice)}
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
