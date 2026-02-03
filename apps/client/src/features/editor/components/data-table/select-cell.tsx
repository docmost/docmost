import { Badge, Box, Combobox, useCombobox, ActionIcon, Group, ColorSwatch, Menu } from "@mantine/core";
import { IconX } from "@tabler/icons-react";
import classes from "./data-table.module.css";
import { DataTableColumn } from "@docmost/editor-ext";
import { useState } from "react";

interface SelectCellProps {
    value: string;
    column: DataTableColumn;
    onChange: (value: string) => void;
    onUpdateColumn: (column: DataTableColumn) => void;
    isEditable: boolean;
    canManageOptions?: boolean;
}

const COLORS = ['#fa5252', '#fd7e14', '#fab005', '#40c057', '#228be6', '#be4bdb', '#7950f2', '#868e96'];

export function SelectCell({ value, column, onChange, onUpdateColumn, isEditable, canManageOptions }: SelectCellProps) {
    const combobox = useCombobox({
        onDropdownClose: () => combobox.resetSelectedOption(),
    });

    const [search, setSearch] = useState("");
    const options = column.options || [];

    const handleOptionSubmit = (val: string) => {
        // If val is not in existing options (by label or id), create it
        const existing = options.find(o => o.id === val || o.label === val);
        if (!existing) {
            // Create new
            const newOption = {
                id: val.toLowerCase().replace(/\s+/g, '-'),
                label: val,
                color: COLORS[options.length % COLORS.length],
                group: 'Other'
            };
            onUpdateColumn({
                ...column,
                options: [...options, newOption]
            });
            onChange(newOption.id);
        } else {
            onChange(existing.id);
        }
        combobox.closeDropdown();
        setSearch("");
    };

    const selectedOption = options.find(o => o.id === value);

    const canManage = canManageOptions !== undefined ? canManageOptions : isEditable;

    return (
        <Combobox
            store={combobox}
            onOptionSubmit={handleOptionSubmit}
            withinPortal={true}
            disabled={!isEditable}
        >
            <Combobox.Target>
                <Box
                    className={classes.cellInput}
                    onClick={() => isEditable && combobox.openDropdown()}
                    style={{ width: "100%", height: "100%", cursor: isEditable ? "pointer" : "default", display: "flex", alignItems: "center", padding: "0 8px" }}
                >
                    {selectedOption ? (
                        <Badge color={selectedOption.color} variant="light">
                            {selectedOption.label}
                        </Badge>
                    ) : (
                        <span style={{ color: "var(--mantine-color-dimmed)", fontStyle: "italic", fontSize: "14px" }}>Select</span>
                    )}
                </Box>
            </Combobox.Target>

            {isEditable && (
                <Combobox.Dropdown style={{ zIndex: 1000 }}>
                    <Combobox.Search
                        value={search}
                        onChange={(event) => {
                            setSearch(event.currentTarget.value);
                            combobox.updateSelectedOptionIndex();
                        }}
                        placeholder="Search..."
                    />
                    <Combobox.Options>
                        {options.length > 0 && Object.entries(
                            options.reduce((acc, item) => {
                                const group = item.group || 'Other';
                                if (!acc[group]) acc[group] = [];
                                acc[group].push(item);
                                return acc;
                            }, {} as Record<string, typeof options>)
                        ).map(([group, groupOptions]) => (
                            <Combobox.Group label={group} key={group}>
                                {groupOptions.filter(o => o.label.toLowerCase().includes(search.toLowerCase())).map((item) => (
                                    <Combobox.Option value={item.id} key={item.id}>
                                        <Group justify="space-between" wrap="nowrap" w="100%">
                                            <Badge color={item.color} variant="light">{item.label}</Badge>
                                            {canManage && (
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
                                            )}
                                        </Group>
                                    </Combobox.Option>
                                ))}
                            </Combobox.Group>
                        ))}

                        {canManage && search.trim().length > 0 && !options.some(o => o.label.toLowerCase() === search.toLowerCase()) && (
                            <Combobox.Option value={search}>
                                + Create "{search}"
                            </Combobox.Option>
                        )}
                    </Combobox.Options>
                </Combobox.Dropdown>
            )}
        </Combobox>
    );
}