import { ActionIcon, Button, Group, Menu, Select, TextInput, Badge, Box } from "@mantine/core";
import { IconFilter, IconX, IconPlus } from "@tabler/icons-react";
import { DataTableColumn, DataTableFilter } from "@docmost/editor-ext";
import { useState } from "react";

interface FilterDropdownProps {
    columns: DataTableColumn[];
    filters: DataTableFilter[];
    onFiltersChange: (filters: DataTableFilter[]) => void;
}

const FILTER_OPERATORS: Record<string, { value: string; label: string }[]> = {
    text: [
        { value: "contains", label: "Contains" },
        { value: "notContains", label: "Does not contain" },
        { value: "is", label: "Is" },
        { value: "isNot", label: "Is not" },
        { value: "startsWith", label: "Starts with" },
        { value: "endsWith", label: "Ends with" },
        { value: "isEmpty", label: "Is empty" },
        { value: "isNotEmpty", label: "Is not empty" },
    ],
    number: [
        { value: "equals", label: "=" },
        { value: "notEquals", label: "≠" },
        { value: "greaterThan", label: ">" },
        { value: "lessThan", label: "<" },
        { value: "greaterThanOrEqual", label: "≥" },
        { value: "lessThanOrEqual", label: "≤" },
        { value: "isEmpty", label: "Is empty" },
        { value: "isNotEmpty", label: "Is not empty" },
    ],
    select: [
        { value: "is", label: "Is" },
        { value: "isNot", label: "Is not" },
        { value: "isEmpty", label: "Is empty" },
        { value: "isNotEmpty", label: "Is not empty" },
    ],
    status: [
        { value: "is", label: "Is" },
        { value: "isNot", label: "Is not" },
        { value: "isEmpty", label: "Is empty" },
        { value: "isNotEmpty", label: "Is not empty" },
    ],
    "multi-select": [
        { value: "contains", label: "Contains" },
        { value: "notContains", label: "Does not contain" },
        { value: "isEmpty", label: "Is empty" },
        { value: "isNotEmpty", label: "Is not empty" },
    ],
    checkbox: [
        { value: "isChecked", label: "Is checked" },
        { value: "isNotChecked", label: "Is not checked" },
    ],
    date: [
        { value: "is", label: "Is" },
        { value: "isBefore", label: "Is before" },
        { value: "isAfter", label: "Is after" },
        { value: "isEmpty", label: "Is empty" },
        { value: "isNotEmpty", label: "Is not empty" },
    ],
    person: [
        { value: "is", label: "Is" },
        { value: "isNot", label: "Is not" },
        { value: "isEmpty", label: "Is empty" },
        { value: "isNotEmpty", label: "Is not empty" },
    ],
    "rich-text": [
        { value: "contains", label: "Contains" },
        { value: "notContains", label: "Does not contain" },
        { value: "isEmpty", label: "Is empty" },
        { value: "isNotEmpty", label: "Is not empty" },
    ],
};

export function FilterDropdown({ columns, filters, onFiltersChange }: FilterDropdownProps) {
    const [opened, setOpened] = useState(false);

    const addFilter = () => {
        const newFilter: DataTableFilter = {
            id: `filter-${Date.now()}`,
            columnId: columns[0]?.id || "",
            operator: "contains",
            value: "",
        };
        onFiltersChange([...filters, newFilter]);
    };

    const updateFilter = (filterId: string, updates: Partial<DataTableFilter>) => {
        onFiltersChange(
            filters.map((f) => (f.id === filterId ? { ...f, ...updates } : f))
        );
    };

    const removeFilter = (filterId: string) => {
        onFiltersChange(filters.filter((f) => f.id !== filterId));
    };

    const needsValueInput = (operator: string) => {
        return !["isEmpty", "isNotEmpty", "isChecked", "isNotChecked"].includes(operator);
    };

    return (
        <Menu opened={opened} onChange={setOpened} position="bottom-start" withinPortal>
            <Menu.Target>
                <Button
                    variant="subtle"
                    size="xs"
                    leftSection={<IconFilter size={14} />}
                    rightSection={filters.length > 0 ? <Badge size="xs" circle>{filters.length}</Badge> : null}
                >
                    Filter
                </Button>
            </Menu.Target>

            <Menu.Dropdown style={{ minWidth: 500, maxWidth: 600 }}>
                <Box p="xs">
                    {filters.length === 0 ? (
                        <Box p="md" style={{ textAlign: "center", color: "var(--mantine-color-dimmed)" }}>
                            No filters applied
                        </Box>
                    ) : (
                        <Box>
                            {filters.map((filter) => {
                                const column = columns.find((c) => c.id === filter.columnId);
                                const operators = column ? FILTER_OPERATORS[column.type] || FILTER_OPERATORS.text : FILTER_OPERATORS.text;

                                return (
                                    <Group key={filter.id} mb="xs" wrap="nowrap" align="flex-start">
                                        <Select
                                            size="xs"
                                            value={filter.columnId}
                                            onChange={(value) => value && updateFilter(filter.id, { columnId: value, operator: "contains", value: "" })}
                                            data={columns.map((col) => ({ value: col.id, label: col.name }))}
                                            style={{ flex: "0 0 150px" }}
                                        />
                                        <Select
                                            size="xs"
                                            value={filter.operator}
                                            onChange={(value) => value && updateFilter(filter.id, { operator: value })}
                                            data={operators}
                                            style={{ flex: "0 0 150px" }}
                                        />
                                        {needsValueInput(filter.operator) && (
                                            column?.type === "select" || column?.type === "status" ? (
                                                <Select
                                                    size="xs"
                                                    value={filter.value}
                                                    onChange={(value) => updateFilter(filter.id, { value: value || "" })}
                                                    data={column.options?.map((opt) => ({ value: opt.id, label: opt.label })) || []}
                                                    placeholder="Select value..."
                                                    style={{ flex: 1 }}
                                                    clearable
                                                />
                                            ) : (
                                                <TextInput
                                                    size="xs"
                                                    value={filter.value}
                                                    onChange={(e) => updateFilter(filter.id, { value: e.currentTarget.value })}
                                                    placeholder="Value..."
                                                    style={{ flex: 1 }}
                                                />
                                            )
                                        )}
                                        <ActionIcon
                                            size="xs"
                                            variant="subtle"
                                            color="red"
                                            onClick={() => removeFilter(filter.id)}
                                        >
                                            <IconX size={14} />
                                        </ActionIcon>
                                    </Group>
                                );
                            })}
                        </Box>
                    )}

                    <Button
                        variant="subtle"
                        size="xs"
                        leftSection={<IconPlus size={14} />}
                        onClick={addFilter}
                        mt="xs"
                        fullWidth
                    >
                        Add filter
                    </Button>
                </Box>
            </Menu.Dropdown>
        </Menu>
    );
}
