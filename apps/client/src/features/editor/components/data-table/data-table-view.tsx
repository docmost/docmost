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
    IconSearch
} from "@tabler/icons-react";
import { DataTableColumn, DataTableRow } from "@docmost/editor-ext";
import classes from "./data-table.module.css";
import { useDisclosure } from "@mantine/hooks";
import React, { useState, useMemo, useRef, useEffect } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { baseExtensions } from "@/features/editor/extensions/extensions";
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

const ALLOWED_PROPERTY_TYPES = ['text', 'date', 'person'];

const IconMap: Record<string, any> = {
    text: IconAlphabetLatin,
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
    const { node, updateAttributes, editor } = props;
    const { columns, rows } = node.attrs as { columns: DataTableColumn[]; rows: DataTableRow[] };

    // Use useEditorState for true reactivity to global editor state
    const isEditable = useEditorState({
        editor,
        selector: (ctx) => ctx.editor.isEditable
    });

    const [opened, { open, close }] = useDisclosure(false);
    const [showAllProperties, { toggle: toggleAllProperties }] = useDisclosure(false);
    const [activeRowId, setActiveRowId] = useState<string | null>(null);
    const menuContainerRef = useRef<HTMLDivElement>(null);
    const [search, setSearch] = useState("");

    const totalColumnsWidth = useMemo(() => {
        return columns.reduce((acc, col) => acc + (col.width || 150), 0);
    }, [columns]);

    const activeRow = useMemo(() => rows.find(r => r.id === activeRowId), [rows, activeRowId]);

    const isRowEmpty = (row: DataTableRow) => {
        const hasData = columns.some(col => row[col.id] && row[col.id]?.toString().trim() !== "");
        // Check if content exists and isn't just an empty paragraph
        const content = row.content as any;
        const hasContent = content && content.content && content.content.length > 0 &&
            !(content.content.length === 1 && content.content[0].type === 'paragraph' && !content.content[0].content);
        return !hasData && !hasContent;
    };

    const visibleRows = useMemo(() => {
        if (isEditable) return rows;
        return rows.filter(row => !isRowEmpty(row));
    }, [rows, columns, isEditable]);

    const visibleProperties = useMemo(() => {
        if (showAllProperties) return columns;
        return columns.slice(0, 4); // Show Name + 3 properties by default
    }, [columns, showAllProperties]);

    const hiddenCount = columns.length - visibleProperties.length;

    const rowsRef = useRef(rows);
    rowsRef.current = rows;

    const rowEditor = useEditor({
        extensions: baseExtensions,
        content: activeRow?.content || "",
        editable: isEditable,
        immediatelyRender: false,
        editorProps: {
            handleDOMEvents: {
                keydown: (_view, event) => {
                    if (["ArrowUp", "ArrowDown", "Enter"].includes(event.key)) {
                        const slashCommand = document.querySelector("#slash-command");
                        if (slashCommand) {
                            return true;
                        }
                    }
                    return false;
                },
            },
        },
        onCreate({ editor: e }) {
            e.storage.pageId = editor.storage.pageId;
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

    // Reactively sync nested row editor and clear highlights when switching to read-only Mode
    useEffect(() => {
        if (rowEditor && !rowEditor.isDestroyed) {
            rowEditor.setEditable(isEditable);
        }

        if (!isEditable) {
            // Forcefully clear node selection and blur to remove highlights immediately
            editor.commands.blur();
        }
    }, [isEditable, rowEditor, editor]);

    // Force re-render on editor state changes (Edit/Read mode toggle)
    const [, setTick] = useState(0);
    useEffect(() => {
        const update = () => {
            setTick(t => t + 1);
        };

        // Aggressive listening to all relevant events
        editor.on('transaction', update);
        editor.on('selectionUpdate', update);
        editor.on('update', update);
        editor.on('focus', update);
        editor.on('blur', update);

        // Safety polling to catch mode changes that don't trigger events
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
        columns.forEach(col => {
            (newRow as any)[col.id] = "";
        });
        updateAttributes({ rows: [...rows, newRow] });
    };

    const removeRow = (rowId: string) => {
        if (!isEditable) return;
        updateAttributes({ rows: rows.filter(r => r.id !== rowId) });
    };

    const updateCell = (rowId: string, colId: string, value: string) => {
        if (!isEditable) return;
        const newRows = rows.map(row => {
            if (row.id === rowId) {
                return { ...row, [colId]: value };
            }
            return row;
        });
        updateAttributes({ rows: newRows });
    };

    const updateColumnName = (colId: string, name: string) => {
        if (!isEditable) return;
        const newColumns = columns.map(col => {
            if (col.id === colId) {
                return { ...col, name };
            }
            return col;
        });
        updateAttributes({ columns: newColumns });
    };

    const updateColumnWidth = (colId: string, width: number) => {
        if (!isEditable) return;
        const newColumns = columns.map(col => {
            if (col.id === colId) {
                return { ...col, width };
            }
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
        const newColumns = [...columns, { id: newId, name: type.name, type: type.id, width: 150 }];
        const newRows = rows.map(row => ({ ...row, [newId]: "" }));
        updateAttributes({ columns: newColumns, rows: newRows });
    };

    const renderInput = (row: DataTableRow, col: DataTableColumn, variant: 'table' | 'modal' = 'table') => {
        const value = row[col.id] || "";

        if (col.type === 'person') {
            return (
                <PersonCell
                    value={value}
                    onChange={(val) => updateCell(row.id, col.id, val)}
                    isEditable={isEditable}
                />
            );
        }

        if (col.type === 'date') {
            return (
                <DateCell
                    value={value}
                    onChange={(val) => updateCell(row.id, col.id, val)}
                    isEditable={isEditable}
                />
            );
        }

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
                    styles={{
                        input: {
                            fontSize: '14px',
                            fontWeight: isName ? 600 : 400,
                            color: value ? 'inherit' : 'var(--mantine-color-gray-5)'
                        }
                    }}
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
                <ScrollArea.Autosize mah={800} type="always">
                    <div style={{ paddingBottom: 12 }}>
                        <table style={{ width: '100%', minWidth: totalColumnsWidth }}>
                            <thead>
                                <tr>
                                    <th style={{ width: 250, position: 'relative' }}>
                                        <Group gap={8} h="100%" wrap="nowrap">
                                            <IconAlphabetLatin size={14} style={{ color: 'var(--mantine-color-dimmed)' }} />
                                            <Text size="xs" fw={500} c="dimmed">Name</Text>
                                        </Group>
                                    </th>
                                    {columns.slice(1).map((col) => {
                                        const Icon = IconMap[col.type] || IconAlphabetLatin;
                                        return (
                                            <th key={col.id} style={{ minWidth: col.width || 200, position: 'relative' }}>
                                                <Group justify="space-between" wrap="nowrap" h="100%">
                                                    <Group gap={8} wrap="nowrap" style={{ flex: 1 }}>
                                                        <Icon size={14} style={{ color: 'var(--mantine-color-dimmed)', flexShrink: 0 }} />
                                                        {isEditable ? (
                                                            <TextInput
                                                                variant="unstyled"
                                                                value={col.name}
                                                                onChange={(e) => updateColumnName(col.id, e.target.value)}
                                                                className={classes.columnNameInput}
                                                            />
                                                        ) : (
                                                            <Text size="xs" fw={500} c="dimmed" style={{ height: 32, display: 'flex', alignItems: 'center' }}>
                                                                {col.name}
                                                            </Text>
                                                        )}
                                                    </Group>
                                                    {isEditable && (
                                                        <Menu position="bottom-end" shadow="md" withinPortal={false}>
                                                            <Menu.Target>
                                                                <ActionIcon variant="subtle" size="xs" c="dimmed">
                                                                    <IconChevronDown size={12} />
                                                                </ActionIcon>
                                                            </Menu.Target>
                                                            <Menu.Dropdown>
                                                                <Menu.Item
                                                                    color="red"
                                                                    leftSection={<IconTrash size={14} />}
                                                                    onClick={() => removeColumn(col.id)}
                                                                >
                                                                    Delete property
                                                                </Menu.Item>
                                                            </Menu.Dropdown>
                                                        </Menu>
                                                    )}
                                                </Group>
                                                {isEditable && (
                                                    <div
                                                        className={classes.resizeHandle}
                                                        onMouseDown={(e) => handleResizeStart(e, col.id, col.width || 150)}
                                                    />
                                                )}
                                            </th>
                                        );
                                    })}
                                    {isEditable && (
                                        <th>
                                            <Menu position="bottom-start" shadow="md" width={280} offset={2} withinPortal={true} >
                                                <Menu.Target>
                                                    <Button
                                                        h="100%"
                                                        variant="subtle"
                                                        size="compact-xs"
                                                        leftSection={<IconPlus size={14} />}
                                                        className={classes.addPropertyBtn}
                                                        justify="center"
                                                        fullWidth
                                                    >
                                                        Add property
                                                    </Button>
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
                                        </th>
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {visibleRows.map((row) => (
                                    <tr key={row.id} className={classes.tableRow}>
                                        <td style={{ position: 'relative', verticalAlign: 'middle' }} className={classes.firstColumnCell}>
                                            {renderInput(row, columns[0])}
                                            <Button
                                                variant="outline"
                                                size="compact-xs"
                                                className={classes.openButton}
                                                onClick={() => handleOpenRow(row.id)}
                                                leftSection={<IconExternalLink size={12} />}
                                            >
                                                OPEN
                                            </Button>
                                        </td>
                                        {columns.slice(1).map((col) => (
                                            <td key={col.id}>
                                                {renderInput(row, col)}
                                            </td>
                                        ))}
                                        {isEditable && (
                                            <td style={{ width: 40, verticalAlign: 'middle' }}>
                                                <Box style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <ActionIcon
                                                        variant="subtle"
                                                        color="red"
                                                        size="sm"
                                                        onClick={() => removeRow(row.id)}
                                                    >
                                                        <IconTrash size={25} />
                                                    </ActionIcon>
                                                </Box>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </ScrollArea.Autosize>
                {
                    isEditable && (
                        <Button
                            variant="subtle"
                            leftSection={<IconPlus size={16} />}
                            onClick={addRow}
                            fullWidth
                            justify="center"
                        >
                            New
                        </Button>
                    )
                }
            </div >

            <Modal
                opened={opened}
                onClose={close}
                size="90%"
                withCloseButton={false}
                centered
                styles={{
                    content: {
                        padding: "16px",
                    },
                }}
            >
                <Box mb="xl">
                    {visibleProperties.map((col, index) => {
                        const Icon = IconMap[col.type] || IconAlphabetLatin;
                        const isName = index === 0;
                        const value = activeRow ? (activeRow[col.id] || "") : "";

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

                <Box ref={menuContainerRef}
                    style={{ minHeight: '65vh' }}>
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
        </NodeViewWrapper >
    );
}
