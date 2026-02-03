import { Badge, Box, Combobox, useCombobox, Pill, PillsInput, Group, CheckIcon, ColorSwatch, Menu, ActionIcon } from "@mantine/core";
import { IconX } from "@tabler/icons-react";
import classes from "./data-table.module.css";
import { DataTableColumn } from "@docmost/editor-ext";
import { useState } from "react";

interface MultiSelectCellProps {
    value: string; // JSON stringified array of IDs
    column: DataTableColumn;
    onChange: (value: string) => void;
    onUpdateColumn: (column: DataTableColumn) => void;
    isEditable: boolean;
}

const COLORS = ['#fa5252', '#fd7e14', '#fab005', '#40c057', '#228be6', '#be4bdb', '#7950f2', '#868e96'];

export function MultiSelectCell({ value, column, onChange, onUpdateColumn, isEditable }: MultiSelectCellProps) {
    const combobox = useCombobox({
        onDropdownClose: () => combobox.resetSelectedOption(),
        onDropdownOpen: () => combobox.focusSearchInput(),
    });

    const [search, setSearch] = useState("");
    const options = column.options || [];

    // Parse value
    let selectedIds: string[] = [];
    try {
        selectedIds = value ? JSON.parse(value) : [];
        if (!Array.isArray(selectedIds)) selectedIds = [];
    } catch (e) {
        selectedIds = [];
    }

    const handleValueSelect = (val: string) => {
        // Check if creating new
        const existing = options.find(o => o.id === val);
        let idToAdd = val;

        if (!existing) {
            // Check if we are selecting something from search that doesn't exist
            // It comes in as the search string
            const label = val;
            idToAdd = label.toLowerCase().replace(/\s+/g, '-');

            // Add new option
            const newOption = {
                id: idToAdd,
                label: label,
                color: COLORS[options.length % COLORS.length]
            };
            onUpdateColumn({
                ...column,
                options: [...options, newOption]
            });
        } else {
            idToAdd = existing.id;
        }

        const current = selectedIds.includes(idToAdd)
            ? selectedIds.filter((v) => v !== idToAdd)
            : [...selectedIds, idToAdd];

        onChange(JSON.stringify(current));
        setSearch("");
    };

    const handleRemove = (id: string, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent opening dropdown
        const current = selectedIds.filter((v) => v !== id);
        onChange(JSON.stringify(current));
    }

    const values = selectedIds.map(id => {
        const opt = options.find(o => o.id === id);
        return opt ? (
            <Badge key={id} color={opt.color} variant="light" size="sm" style={{ marginRight: 4 }}>
                {opt.label}
                {isEditable && <span style={{ marginLeft: 4, cursor: 'pointer' }} onClick={(e) => handleRemove(id, e)}>×</span>}
            </Badge>
        ) : null;
    }).filter(Boolean);

    return (
        <Combobox store={combobox} onOptionSubmit={handleValueSelect} withinPortal={true} disabled={!isEditable}>
            <Combobox.DropdownTarget>
                <Box
                    className={classes.cellInput}
                    onClick={() => isEditable && combobox.openDropdown()}
                    style={{ width: "100%", minHeight: "100%", cursor: isEditable ? "pointer" : "default", display: "flex", flexWrap: "wrap", alignItems: "center", padding: "4px 8px", gap: "4px" }}
                >
                    {values.length > 0 ? values : <span style={{ color: "var(--mantine-color-dimmed)", fontStyle: "italic", fontSize: "14px" }}>Empty</span>}
                </Box>
            </Combobox.DropdownTarget>

            {
                isEditable && (
                    <Combobox.Dropdown>
                        <Combobox.Search
                            value={search}
                            onChange={(event) => setSearch(event.currentTarget.value)}
                            placeholder="Search or create..."
                        />
                        <Combobox.Options>
                            {options.length > 0 && options.filter(o => o.label.toLowerCase().includes(search.toLowerCase())).map((item) => (
                                <Combobox.Option value={item.id} key={item.id} active={selectedIds.includes(item.id)}>
                                    <Group justify="space-between" wrap="nowrap" w="100%">
                                        <Group gap="sm">
                                            {selectedIds.includes(item.id) ? <CheckIcon size={12} /> : null}
                                            <Badge color={item.color} variant="light">{item.label}</Badge>
                                        </Group>
                                        <Group gap={4} wrap="nowrap">
                                            <Menu position="right" withArrow shadow="md" withinPortal={false} closeOnItemClick={false}>
                                                <Menu.Target>
                                                    <ColorSwatch
                                                        color={item.color}
                                                        size={16}
                                                        style={{ cursor: 'pointer' }}
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                        }}
                                                        onMouseDown={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                        }}
                                                    />
                                                </Menu.Target>
                                                <Menu.Dropdown>
                                                    <Group gap={4} p={4}>
                                                        {COLORS.map((color) => (
                                                            <ColorSwatch
                                                                key={color}
                                                                color={color}
                                                                size={20}
                                                                style={{ cursor: 'pointer' }}
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();
                                                                    const newOptions = options.map(o =>
                                                                        o.id === item.id ? { ...o, color } : o
                                                                    );
                                                                    onUpdateColumn({ ...column, options: newOptions });
                                                                }}
                                                            />
                                                        ))}
                                                    </Group>
                                                </Menu.Dropdown>
                                            </Menu>
                                            <ActionIcon
                                                size="xs"
                                                color="red"
                                                variant="subtle"
                                                onMouseDown={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    const newOptions = options.filter(o => o.id !== item.id);
                                                    onUpdateColumn({ ...column, options: newOptions });
                                                }}
                                            >
                                                <IconX size={12} />
                                            </ActionIcon>
                                        </Group>
                                    </Group>
                                </Combobox.Option>
                            ))}

                            {search.trim().length > 0 && !options.some(o => o.label.toLowerCase() === search.toLowerCase()) && (
                                <Combobox.Option value={search}>
                                    + Create "{search}"
                                </Combobox.Option>
                            )}
                        </Combobox.Options>
                    </Combobox.Dropdown>
                )
            }
        </Combobox >
    );
}
