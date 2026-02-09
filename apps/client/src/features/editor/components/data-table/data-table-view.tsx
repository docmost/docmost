import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import {
    ActionIcon,
    Menu,
    Button,
    Group,
    Modal,
    Box,
    Divider,
    Text,
    ScrollArea,
    UnstyledButton,
    TextInput,
    Textarea
} from "@mantine/core";
import clsx from "clsx";
import {
    IconPlus,
    IconTrash,
    IconChevronDown,
    IconExternalLink,
    IconAlphabetLatin,
    IconHash,
    IconSelect,
    IconList,
    IconFlag,
    IconCalendar,
    IconUser,
    IconPaperclip,
    IconCheckbox,
    IconLink,
    IconPhone,
    IconAt,
    IconArrowUpRight,
    IconArrowMerge,
    IconSum,
    IconHandClick,
    IconId,
    IconMapPin,
    IconClock,
    IconUserCheck,
    IconSearch,
    IconMarkdown,
    IconGripVertical
} from "@tabler/icons-react";
import { DataTableColumn, DataTableRow, DataTableFilter } from "@docmost/editor-ext";
import classes from "./data-table.module.css";
import { useDisclosure } from "@mantine/hooks";
import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { mainExtensions } from "@/features/editor/extensions/extensions";
import useUserRole from "@/hooks/use-user-role";
import { EditorBubbleMenu } from "@/features/editor/components/bubble-menu/bubble-menu";
import TableCellMenu from "@/features/editor/components/table/table-cell-menu.tsx";
import TableMenu from "@/features/editor/components/table/table-menu.tsx";
import CalloutMenu from "@/features/editor/components/callout/callout-menu.tsx";
import VideoMenu from "@/features/editor/components/video/video-menu.tsx";
import SubpagesMenu from "@/features/editor/components/subpages/subpages-menu.tsx";
import ColumnMenu from "@/features/editor/components/columns/column-menu.tsx";
import LinkMenu from "@/features/editor/components/link/link-menu.tsx";
import ExcalidrawMenu from "../excalidraw/excalidraw-menu";
import DrawioMenu from "../drawio/drawio-menu";
import { PersonCell } from "./person-cell";
import { DateCell } from "./date-cell";
import { SelectCell } from "./select-cell";
import { MultiSelectCell } from "./multi-select-cell";
import { CheckboxCell } from "./checkbox-cell";
import { RichTextCell } from "./rich-text-cell";
import { FilterDropdown } from "./filter-dropdown";

// Drag and Drop imports
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    DragStartEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    horizontalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import * as modifiers from '@dnd-kit/modifiers';

const ALLOWED_PROPERTY_TYPES = ['text', 'date', 'person', 'select', 'multi-select', 'checkbox', 'rich-text', 'status'];

const IconMap: Record<string, any> = {
    text: IconAlphabetLatin,
    'rich-text': IconMarkdown,
    number: IconHash,
    select: IconSelect,
    'multi-select': IconList,
    status: IconFlag,
    date: IconCalendar,
    person: IconUser,
    files: IconPaperclip,
    checkbox: IconCheckbox,
    url: IconLink,
    phone: IconPhone,
    email: IconAt,
    relation: IconArrowUpRight,
    rollup: IconArrowMerge,
    formula: IconSum,
    button: IconHandClick,
    id: IconId,
    place: IconMapPin,
    createdTime: IconClock,
    editedTime: IconClock,
    createdBy: IconUserCheck,
    editedBy: IconUserCheck,
};

const PropertyTypes = [
    {
        label: 'Basic', types: [
            { id: 'text', name: 'Text', icon: IconAlphabetLatin },
            { id: 'rich-text', name: 'Rich text', icon: IconMarkdown },
            { id: 'number', name: 'Number', icon: IconHash },
            { id: 'select', name: 'Select', icon: IconSelect },
            { id: 'multi-select', name: 'Multi-select', icon: IconList },
            { id: 'status', name: 'Status', icon: IconFlag },
            { id: 'date', name: 'Date', icon: IconCalendar },
            { id: 'person', name: 'Person', icon: IconUser },
            { id: 'files', name: 'Files & media', icon: IconPaperclip },
            { id: 'checkbox', name: 'Checkbox', icon: IconCheckbox },
            { id: 'url', name: 'URL', icon: IconLink },
            { id: 'phone', name: 'Phone', icon: IconPhone },
            { id: 'email', name: 'Email', icon: IconAt },
        ]
    },
    {
        label: 'Advanced', types: [
            { id: 'relation', name: 'Relation', icon: IconArrowUpRight },
            { id: 'rollup', name: 'Rollup', icon: IconArrowMerge },
            { id: 'formula', name: 'Formula', icon: IconSum },
            { id: 'button', name: 'Button', icon: IconHandClick },
            { id: 'id', name: 'ID', icon: IconId },
            { id: 'place', name: 'Place', icon: IconMapPin },
        ]
    }
];

export default function DataTableView(props: NodeViewProps) {
    const { node, updateAttributes, editor, getPos } = props;
    const { columns, rows, filters = [] } = node.attrs as {
        columns: DataTableColumn[];
        rows: DataTableRow[];
        filters?: DataTableFilter[];
    };

    const { isVisitor } = useUserRole();

    const isEditable = useEditorState({
        editor,
        selector: (ctx) => ctx.editor.isEditable
    });

    const canEditQuickly = !isVisitor;

    const [opened, { open, close }] = useDisclosure(false);
    const [showAllProperties, { toggle: toggleAllProperties }] = useDisclosure(false);
    const [activeRowId, setActiveRowId] = useState<string | null>(null);
    const menuContainerRef = useRef<HTMLDivElement>(null);
    const [search, setSearch] = useState("");
    const [isDragging, setIsDragging] = useState(false);

    const totalColumnsWidth = useMemo(() => {
        return columns.reduce((acc, col) => acc + (col.width || 150), 0);
    }, [columns]);

    const activeRow = useMemo(() => rows.find(r => r.id === activeRowId), [rows, activeRowId]);

    const isRowEmpty = (row: DataTableRow) => {
        const hasData = columns.some(col => row[col.id] && row[col.id]?.toString().trim() !== "");
        const content = row.content as any;
        const hasContent = content && content.content && content.content.length > 0 &&
            !(content.content.length === 1 && content.content[0].type === 'paragraph' && !content.content[0].content);
        return !hasData && !hasContent;
    };

    const evaluateFilter = (row: DataTableRow, filter: DataTableFilter): boolean => {
        const column = columns.find(c => c.id === filter.columnId);
        if (!column) return true;

        const cellValue = row[filter.columnId];
        const filterValue = filter.value;

        if (filter.operator === "isEmpty") return !cellValue || cellValue === "" || cellValue === "[]";
        if (filter.operator === "isNotEmpty") return cellValue && cellValue !== "" && cellValue !== "[]";

        if (column.type === "checkbox") {
            if (filter.operator === "isChecked") return !!cellValue;
            if (filter.operator === "isNotChecked") return !cellValue;
        }

        if (column.type === "text" || column.type === "rich-text") {
            const cellStr = String(cellValue || "").toLowerCase();
            const filterStr = String(filterValue || "").toLowerCase();
            if (filter.operator === "contains") return cellStr.includes(filterStr);
            if (filter.operator === "notContains") return !cellStr.includes(filterStr);
            if (filter.operator === "is") return cellStr === filterStr;
            if (filter.operator === "isNot") return cellStr !== filterStr;
            if (filter.operator === "startsWith") return cellStr.startsWith(filterStr);
            if (filter.operator === "endsWith") return cellStr.endsWith(filterStr);
        }

        if (column.type === "number") {
            const cellNum = parseFloat(cellValue);
            const filterNum = parseFloat(filterValue);
            if (isNaN(cellNum) || isNaN(filterNum)) return false;
            if (filter.operator === "equals") return cellNum === filterNum;
            if (filter.operator === "notEquals") return cellNum !== filterNum;
            if (filter.operator === "greaterThan") return cellNum > filterNum;
            if (filter.operator === "lessThan") return cellNum < filterNum;
            if (filter.operator === "greaterThanOrEqual") return cellNum >= filterNum;
            if (filter.operator === "lessThanOrEqual") return cellNum <= filterNum;
        }

        if (column.type === "select" || column.type === "status") {
            if (filter.operator === "is") return cellValue === filterValue;
            if (filter.operator === "isNot") return cellValue !== filterValue;
        }

        if (column.type === "multi-select") {
            try {
                const selectedIds = JSON.parse(cellValue || "[]");
                if (filter.operator === "contains") return selectedIds.includes(filterValue);
                if (filter.operator === "notContains") return !selectedIds.includes(filterValue);
            } catch { return false; }
        }

        if (column.type === "date") {
            if (!cellValue || !filterValue) return false;
            const cellDate = new Date(cellValue);
            const filterDate = new Date(filterValue);
            if (filter.operator === "is") return cellDate.toDateString() === filterDate.toDateString();
            if (filter.operator === "isBefore") return cellDate < filterDate;
            if (filter.operator === "isAfter") return cellDate > filterDate;
        }
        return true;
    };

    const filteredRows = useMemo(() => {
        if (filters.length === 0) return rows;
        return rows.filter(row => filters.every(filter => evaluateFilter(row, filter)));
    }, [rows, filters, columns]);

    const visibleRows = useMemo(() => {
        if (isEditable) return filteredRows;
        return filteredRows.filter(row => !isRowEmpty(row));
    }, [filteredRows, columns, isEditable]);

    const visibleProperties = useMemo(() => {
        if (showAllProperties) return columns;
        return columns.slice(0, 4);
    }, [columns, showAllProperties]);

    const hiddenCount = columns.length - visibleProperties.length;

    const rowsRef = useRef(rows);
    rowsRef.current = rows;

    const rowEditor = useEditor({
        extensions: mainExtensions,
        content: activeRow?.content || "",
        editable: isEditable,
        immediatelyRender: false,
        onCreate({ editor: e }) {
            queueMicrotask(() => {
                // @ts-ignore
                e.storage.pageId = editor.storage.pageId;
            });
        },
        onUpdate: ({ editor: e }) => {
            if (activeRowId && isEditable) {
                const newRows = rowsRef.current.map(row => {
                    if (row.id === activeRowId) {
                        return { ...row, content: e.getJSON() };
                    }
                    return row;
                });
                updateAttributes({ rows: newRows });
            }
        }
    }, [activeRowId]);

    useEffect(() => {
        queueMicrotask(() => {
            if (rowEditor && !rowEditor.isDestroyed) {
                rowEditor.setEditable(isEditable);
            }
            if (!isEditable) {
                editor.commands.blur();
            }
        });
    }, [isEditable, rowEditor, editor]);

    const [, setTick] = useState(0);
    useEffect(() => {
        const update = () => setTick(t => t + 1);
        editor.on('transaction', update);
        editor.on('selectionUpdate', update);
        editor.on('update', update);
        editor.on('focus', update);
        editor.on('blur', update);
        const interval = setInterval(update, 500);
        return () => {
            editor.off('transaction', update);
            editor.off('selectionUpdate', update);
            editor.off('update', update);
            editor.off('focus', update);
            editor.off('blur', update);
            clearInterval(interval);
        };
    }, [editor]);

    const handleOpenRow = (rowId: string) => {
        setActiveRowId(rowId);
        const row = rows.find(r => r.id === rowId);
        if (rowEditor && row) {
            rowEditor.commands.setContent(row.content || "");
        }
        open();
    };

    const removeColumn = (colId: string) => {
        if (!isEditable) return;
        const newColumns = columns.filter(c => c.id !== colId);
        const newRows = rows.map(row => {
            const { [colId]: _, ...rest } = row;
            return rest;
        });
        updateAttributes({ columns: newColumns, rows: newRows });
    };

    const addRow = () => {
        if (!isEditable) return;
        const newId = `row-${Date.now()}`;
        const newRow = { id: newId, content: null };
        columns.forEach(col => { (newRow as any)[col.id] = ""; });
        updateAttributes({ rows: [...rows, newRow] });
    };

    const removeRow = (rowId: string) => {
        if (!isEditable) return;
        updateAttributes({ rows: rows.filter(r => r.id !== rowId) });
    };

    const updateCell = (rowId: string, colId: string, value: string) => {
        const newRows = rows.map(row => {
            if (row.id === rowId) {
                return { ...row, [colId]: value };
            }
            return row;
        });

        if (isEditable) {
            updateAttributes({ rows: newRows });
        } else if (canEditQuickly) {
            editor.commands.command(({ tr }) => {
                if (typeof getPos === 'function') {
                    tr.setNodeMarkup(getPos(), undefined, {
                        ...node.attrs,
                        rows: newRows,
                    });
                    tr.setMeta('addToHistory', false);
                }
                return true;
            });
        }
    };

    const updateColumnName = (colId: string, name: string) => {
        if (!isEditable) return;
        const newColumns = columns.map(col => {
            if (col.id === colId) return { ...col, name };
            return col;
        });
        updateAttributes({ columns: newColumns });
    };

    const updateColumnWidth = (colId: string, width: number) => {
        if (!isEditable) return;
        const newColumns = columns.map(col => {
            if (col.id === colId) return { ...col, width };
            return col;
        });
        updateAttributes({ columns: newColumns });
    };

    const handleResizeStart = (e: React.MouseEvent, colId: string, currentWidth: number) => {
        if (!isEditable) return;
        e.preventDefault();
        const startX = e.pageX;
        const startWidth = currentWidth || 150;
        const handleMouseMove = (moveEvent: MouseEvent) => {
            const deltaX = moveEvent.pageX - startX;
            const newWidth = Math.max(100, startWidth + deltaX);
            updateColumnWidth(colId, newWidth);
        };
        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    const onAddProperty = (type: any) => {
        if (!isEditable) return;
        const newId = `col-${Date.now()}`;
        let initialOptions = undefined;
        if (type.id === 'status') {
            initialOptions = [
                { id: 'not-started', label: 'Not started', color: 'gray', group: 'To-do' },
                { id: 'in-progress', label: 'In progress', color: 'blue', group: 'In progress' },
                { id: 'done', label: 'Done', color: 'green', group: 'Complete' }
            ];
        }
        const newColumns = [...columns, { id: newId, name: type.name, type: type.id, width: 150, options: initialOptions }];
        const newRows = rows.map(row => ({ ...row, [newId]: "" }));
        updateAttributes({ columns: newColumns, rows: newRows });
    };

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleRowDragStart = () => setIsDragging(true);
    const handleRowDragEnd = (event: DragEndEvent) => {
        setIsDragging(false);
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const oldIndex = rows.findIndex((row) => row.id === active.id);
        const newIndex = rows.findIndex((row) => row.id === over.id);
        const newRows = arrayMove(rows, oldIndex, newIndex);
        updateAttributes({ rows: newRows });
    };

    const handleColumnDragStart = () => setIsDragging(true);
    const handleColumnDragEnd = (event: DragEndEvent) => {
        setIsDragging(false);
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const oldIndex = columns.findIndex((col) => col.id === active.id);
        const newIndex = columns.findIndex((col) => col.id === over.id);
        if (oldIndex === 0 || newIndex === 0) return;
        const newColumns = arrayMove(columns, oldIndex, newIndex);
        updateAttributes({ columns: newColumns });
    };

    const renderInput = (row: DataTableRow, col: DataTableColumn, variant: 'table' | 'modal' = 'table') => {
        const value = row[col.id] || "";
        if (col.type === 'person') return <PersonCell value={value} onChange={(val) => updateCell(row.id, col.id, val)} isEditable={isEditable} />;
        if (col.type === 'date') return <DateCell value={value} onChange={(val) => updateCell(row.id, col.id, val)} isEditable={isEditable} />;
        if (col.type === 'select' || col.type === 'status') {
            const canEdit = isEditable || (canEditQuickly && col.type === 'status');
            return (
                <SelectCell
                    value={value}
                    column={col}
                    onChange={(val) => updateCell(row.id, col.id, val)}
                    onUpdateColumn={(newCol) => {
                        const newColumns = columns.map(c => c.id === newCol.id ? newCol : c);
                        if (isEditable) {
                            updateAttributes({ columns: newColumns });
                        } else if (canEditQuickly) {
                            editor.commands.command(({ tr }) => {
                                if (typeof getPos === 'function') {
                                    tr.setNodeMarkup(getPos(), undefined, {
                                        ...node.attrs,
                                        columns: newColumns,
                                    });
                                    tr.setMeta('addToHistory', false);
                                }
                                return true;
                            });
                        }
                    }}
                    isEditable={canEdit}
                    canManageOptions={isEditable}
                />
            );
        }

        if (col.type === 'multi-select') {
            return (
                <MultiSelectCell
                    value={value}
                    column={col}
                    onChange={(val) => updateCell(row.id, col.id, val)}
                    onUpdateColumn={(newCol) => {
                        const newColumns = columns.map(c => c.id === newCol.id ? newCol : c);
                        updateAttributes({ columns: newColumns });
                    }}
                    isEditable={isEditable}
                />
            );
        }

        if (col.type === 'checkbox') {
            const boolValue = typeof value === 'string' ? value === 'true' : !!value;
            return (
                <CheckboxCell
                    value={boolValue}
                    onChange={(val) => updateCell(row.id, col.id, String(val))}
                    isEditable={canEditQuickly}
                />
            );
        }

        if (col.type === 'rich-text') return <RichTextCell value={value} onChange={(val) => updateCell(row.id, col.id, val)} isEditable={isEditable} />;
        if (variant === 'modal') {
            const isName = columns[0]?.id === col.id;
            return (
                <TextInput
                    variant="unstyled"
                    value={value}
                    onChange={(e) => updateCell(row.id, col.id, e.target.value)}
                    readOnly={!isEditable}
                    placeholder={!isName ? "Empty" : "Untitled"}
                    style={{ flex: 1 }}
                    styles={{ input: { fontSize: '14px', fontWeight: isName ? 600 : 400, color: value ? 'inherit' : 'var(--mantine-color-gray-5)' } }}
                />
            );
        }
        return (
            <Textarea
                variant="unstyled"
                value={value}
                onChange={(e) => updateCell(row.id, col.id, e.target.value)}
                readOnly={!isEditable}
                tabIndex={isEditable ? 0 : -1}
                className={classes.cellInput}
                style={{ width: '100%', minHeight: '100%' }}
                autosize
                minRows={1}
            />
        );
    };

    return (
        <NodeViewWrapper
            className={clsx(classes.dataTableWrapper, "docmost-data-table")}
            data-read-only={!isEditable}
            selectable="false"
        >
            <div className={classes.tableContainer}>
                <Box className={classes.controlTable}>
                    <Group gap="xs">
                        {isEditable && (
                            <Menu position="bottom-start" shadow="md" width={280} offset={2} withinPortal={true}>
                                <Menu.Target>
                                    <Button variant="subtle" size="xs" leftSection={<IconPlus size={14} />}>Add property</Button>
                                </Menu.Target>
                                <Menu.Dropdown p="xs">
                                    <TextInput
                                        placeholder="Select type"
                                        leftSection={<IconSearch size={14} />}
                                        size="xs"
                                        mb="xs"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                    />
                                    <ScrollArea.Autosize mah={300} type="scroll">
                                        {PropertyTypes.map(group => {
                                            const filtered = group.types.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));
                                            if (filtered.length === 0) return null;
                                            return (
                                                <Box key={group.label} mb="xs">
                                                    <Text size="xs" c="dimmed" mb={4} px={4}>{group.label}</Text>
                                                    <Box style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px' }}>
                                                        {filtered.map(type => {
                                                            const isAllowed = ALLOWED_PROPERTY_TYPES.includes(type.id);
                                                            return (
                                                                <UnstyledButton
                                                                    key={type.id}
                                                                    className={clsx(classes.typeButton, !isAllowed && classes.typeButtonDisabled)}
                                                                    onClick={() => isAllowed && onAddProperty(type)}
                                                                    disabled={!isAllowed}
                                                                >
                                                                    <Group gap={8} wrap="nowrap">
                                                                        <type.icon size={14} style={{ flexShrink: 0 }} />
                                                                        <Text size="xs" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{type.name}</Text>
                                                                    </Group>
                                                                </UnstyledButton>
                                                            );
                                                        })}
                                                    </Box>
                                                </Box>
                                            );
                                        })}
                                    </ScrollArea.Autosize>
                                </Menu.Dropdown>
                            </Menu>
                        )}
                        <FilterDropdown
                            columns={columns}
                            filters={filters}
                            onFiltersChange={(newFilters) => updateAttributes({ filters: newFilters })}
                        />
                    </Group>
                </Box>
                <ScrollArea.Autosize mah={800} type="always">
                    <div style={{ paddingBottom: 12 }}>
                        <table style={{ width: '100%', minWidth: totalColumnsWidth }}>
                            <thead>
                                <DndContext
                                    sensors={sensors}
                                    collisionDetection={closestCenter}
                                    onDragStart={handleColumnDragStart}
                                    onDragEnd={handleColumnDragEnd}
                                    modifiers={[modifiers.restrictToHorizontalAxis]}
                                    autoScroll={false}
                                >
                                    <SortableContext items={columns.map(c => c.id)} strategy={horizontalListSortingStrategy}>
                                        <tr>
                                            {isEditable && (
                                                <th style={{ width: 50, textAlign: 'center', verticalAlign: 'middle' }}>
                                                    <ActionIcon variant="subtle" size="sm" onClick={addRow} c="dimmed"><IconPlus size={16} /></ActionIcon>
                                                </th>
                                            )}
                                            {columns.map((col, idx) => (
                                                <SortableHeader
                                                    key={col.id}
                                                    col={col}
                                                    idx={idx}
                                                    isEditable={isEditable}
                                                    updateColumnName={updateColumnName}
                                                    removeColumn={removeColumn}
                                                    handleResizeStart={handleResizeStart}
                                                />
                                            ))}
                                        </tr>
                                    </SortableContext>
                                </DndContext>
                            </thead>
                            <tbody>
                                <DndContext
                                    sensors={sensors}
                                    collisionDetection={closestCenter}
                                    onDragStart={handleRowDragStart}
                                    onDragEnd={handleRowDragEnd}
                                    modifiers={[modifiers.restrictToVerticalAxis]}
                                    autoScroll={false}
                                >
                                    <SortableContext items={visibleRows.map(r => r.id)} strategy={verticalListSortingStrategy}>
                                        {visibleRows.map((row, idx) => (
                                            <SortableRow
                                                key={row.id}
                                                row={row}
                                                idx={idx}
                                                columns={columns}
                                                isEditable={isEditable}
                                                removeRow={removeRow}
                                                renderInput={renderInput}
                                                handleOpenRow={handleOpenRow}
                                            />
                                        ))}
                                    </SortableContext>
                                </DndContext>
                            </tbody>
                        </table>
                    </div>
                </ScrollArea.Autosize>
            </div>

            <Modal opened={opened} onClose={close} size="90%" withCloseButton={false} centered styles={{ content: { padding: "16px" } }}>
                <Box mb="xl">
                    {visibleProperties.map((col, index) => {
                        const Icon = IconMap[col.type] || IconAlphabetLatin;
                        return (
                            <Group key={col.id} mb="sm" wrap="nowrap" align="center">
                                <Box style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <Icon size={18} style={{ color: 'var(--mantine-color-dimmed)' }} />
                                </Box>
                                <Text size="sm" w={140} c="dimmed" style={{ flexShrink: 0 }}>{col.name}</Text>
                                {activeRow && renderInput(activeRow, col, 'modal')}
                            </Group>
                        );
                    })}
                    {!showAllProperties && hiddenCount > 0 && (
                        <UnstyledButton onClick={toggleAllProperties} mt="xs">
                            <Group gap={8}>
                                <IconChevronDown size={14} style={{ color: 'var(--mantine-color-dimmed)' }} />
                                <Text size="sm" c="dimmed">{hiddenCount} more properties</Text>
                            </Group>
                        </UnstyledButton>
                    )}
                    {showAllProperties && columns.length > 4 && (
                        <UnstyledButton onClick={toggleAllProperties} mt="xs">
                            <Group gap={8}>
                                <IconChevronDown size={14} style={{ color: 'var(--mantine-color-dimmed)', transform: 'rotate(180deg)' }} />
                                <Text size="sm" c="dimmed">Show fewer properties</Text>
                            </Group>
                        </UnstyledButton>
                    )}
                </Box>
                <Divider my="xl" label="Page Content" labelPosition="center" />
                <Box ref={menuContainerRef} style={{ minHeight: '65vh' }}>
                    <EditorContent editor={rowEditor} className={classes.modalEditor} />
                    {rowEditor && isEditable && (
                        <>
                            <EditorBubbleMenu editor={rowEditor} />
                            <TableMenu editor={rowEditor} />
                            <TableCellMenu editor={rowEditor} appendTo={menuContainerRef} />
                            <VideoMenu editor={rowEditor} />
                            <CalloutMenu editor={rowEditor} />
                            <SubpagesMenu editor={rowEditor} />
                            <ColumnMenu editor={rowEditor} />
                            <ExcalidrawMenu editor={rowEditor} />
                            <DrawioMenu editor={rowEditor} />
                            <LinkMenu editor={rowEditor} appendTo={menuContainerRef} />
                        </>
                    )}
                </Box>
            </Modal>
        </NodeViewWrapper>
    );
}

function SortableHeader({ col, idx, isEditable, updateColumnName, removeColumn, handleResizeStart }: any) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: col.id, disabled: idx === 0 });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : 1,
        minWidth: col.width || (idx === 0 ? 250 : 200),
        position: 'relative' as const,
        opacity: isDragging ? 0.5 : 1,
    };
    const Icon = IconMap[col.type] || IconAlphabetLatin;
    return (
        <th ref={setNodeRef} style={style}>
            <Group justify="space-between" wrap="nowrap" h="100%">
                <Group gap={8} wrap="nowrap" style={{ flex: 1 }}>
                    {isEditable && idx !== 0 ? (
                        <div {...attributes} {...listeners} className={classes.gripHandle}>
                            <IconGripVertical size={14} style={{ color: 'var(--mantine-color-dimmed)' }} />
                        </div>
                    ) : (
                        idx !== 0 && <Icon size={14} style={{ color: 'var(--mantine-color-dimmed)', flexShrink: 0 }} />
                    )}
                    {idx === 0 && <IconAlphabetLatin size={14} style={{ color: 'var(--mantine-color-dimmed)', flexShrink: 0 }} />}

                    {idx === 0 ? (
                        <Text size="xs" fw={500} c="dimmed">Name</Text>
                    ) : (
                        isEditable ? (
                            <TextInput
                                variant="unstyled"
                                value={col.name}
                                onChange={(e) => updateColumnName(col.id, e.target.value)}
                                className={classes.columnNameInput}
                            />
                        ) : (
                            <Text size="xs" fw={500} c="dimmed" style={{ height: 32, display: 'flex', alignItems: 'center' }}>{col.name}</Text>
                        )
                    )}
                </Group>
                {isEditable && idx !== 0 && (
                    <Menu position="bottom-end" shadow="md" withinPortal={false}>
                        <Menu.Target>
                            <ActionIcon variant="subtle" size="xs" c="dimmed"><IconChevronDown size={12} /></ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                            <Menu.Item color="red" leftSection={<IconTrash size={14} />} onClick={() => removeColumn(col.id)}>Delete property</Menu.Item>
                        </Menu.Dropdown>
                    </Menu>
                )}
            </Group>
            {isEditable && (<div className={classes.resizeHandle} onMouseDown={(e) => handleResizeStart(e, col.id, col.width || 150)} />)}
        </th>
    );
}

function SortableRow({ row, idx, columns, isEditable, removeRow, renderInput, handleOpenRow }: any) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.id });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : 1,
        opacity: isDragging ? 0.5 : 1,
    };
    return (
        <tr ref={setNodeRef} style={style} className={classes.tableRow}>
            {isEditable && (
                <td style={{ width: 40, verticalAlign: 'middle', textAlign: 'center' }}>
                    <Group gap={4} wrap="nowrap">
                        <div {...attributes} {...listeners} className={classes.gripHandle}>
                            <IconGripVertical size={14} style={{ color: 'var(--mantine-color-dimmed)' }} />
                        </div>
                        <ActionIcon variant="subtle" color="red" size="sm" onClick={() => removeRow(row.id)}><IconTrash size={16} /></ActionIcon>
                    </Group>
                </td>
            )}
            <td style={{ position: 'relative', verticalAlign: 'middle' }} className={classes.firstColumnCell}>
                {renderInput(row, columns[0])}
                <Button variant="outline" size="compact-xs" className={classes.openButton} onClick={() => handleOpenRow(row.id)} leftSection={<IconExternalLink size={12} />}>OPEN</Button>
            </td>
            {columns.slice(1).map((col: any) => (<td key={col.id}>{renderInput(row, col)}</td>))}
        </tr>
    );
}