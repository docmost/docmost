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
    Paper,
    Badge,
    Stack
} from "@mantine/core";
import clsx from "clsx";
import {
    IconPlus,
    IconTrash,
    IconChevronDown,
    IconDotsVertical,
    IconArrowLeft,
    IconArrowRight,
    IconArrowUp,
    IconArrowDown,
    IconEdit
} from "@tabler/icons-react";
import { KanbanColumn, KanbanCard } from "@docmost/editor-ext";
import classes from "./kanban-board.module.css";
import { useDisclosure } from "@mantine/hooks";
import React, { useState, useMemo, useRef, useEffect } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { baseExtensions } from "@/features/editor/extensions/extensions";
import { EditorBubbleMenu } from "@/features/editor/components/bubble-menu/bubble-menu";
import TableCellMenu from "@/features/editor/components/table/table-cell-menu.tsx";
import TableMenu from "@/features/editor/components/table/table-menu.tsx";
import ImageMenu from "@/features/editor/components/image/image-menu.tsx";
import CalloutMenu from "@/features/editor/components/callout/callout-menu.tsx";
import VideoMenu from "@/features/editor/components/video/video-menu.tsx";
import SubpagesMenu from "@/features/editor/components/subpages/subpages-menu.tsx";
import ColumnMenu from "@/features/editor/components/columns/column-menu.tsx";
import LinkMenu from "@/features/editor/components/link/link-menu.tsx";
import ExcalidrawMenu from "../excalidraw/excalidraw-menu";
import DrawioMenu from "../drawio/drawio-menu";

export default function KanbanBoardView(props: NodeViewProps) {
    const { node, updateAttributes, editor } = props;
    const { columns, cards } = node.attrs as { columns: KanbanColumn[]; cards: KanbanCard[] };

    const isEditable = useEditorState({
        editor,
        selector: (ctx) => ctx.editor.isEditable
    });

    const [opened, { open, close }] = useDisclosure(false);
    const [activeCardId, setActiveCardId] = useState<string | null>(null);
    const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
    const [dragOverColId, setDragOverColId] = useState<string | null>(null);
    const [isDragOverDelete, setIsDragOverDelete] = useState(false);
    const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
    const [selectionBox, setSelectionBox] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null);
    const menuContainerRef = useRef<HTMLDivElement>(null);
    const boardRef = useRef<HTMLDivElement>(null);

    const activeCard = useMemo(() => cards.find(c => c.id === activeCardId), [cards, activeCardId]);

    const cardsRef = useRef(cards);
    cardsRef.current = cards;

    const cardEditor = useEditor({
        extensions: baseExtensions,
        content: activeCard?.content || "",
        editable: true,
        immediatelyRender: false,
        onCreate({ editor: e }) {
            e.storage.pageId = editor.storage.pageId;
        },
        onUpdate: ({ editor: e }) => {
            if (activeCardId) {
                const newCards = cardsRef.current.map(card => {
                    if (card.id === activeCardId) {
                        return { ...card, content: e.getJSON() };
                    }
                    return card;
                });
                updateAttributes({ cards: newCards });
            }
        }
    }, [activeCardId]);

    useEffect(() => {
        if (cardEditor && !cardEditor.isDestroyed) {
            cardEditor.setEditable(true);
        }
    }, [cardEditor]);

    const handleOpenCard = (cardId: string) => {
        setActiveCardId(cardId);
        setSelectedCardIds([cardId]);
        const card = cards.find(c => c.id === cardId);
        if (cardEditor && card) {
            cardEditor.commands.setContent(card.content || "");
        }
        open();
    };

    const toggleCardSelection = (cardId: string, isMulti: boolean) => {
        if (isMulti) {
            setSelectedCardIds(prev =>
                prev.includes(cardId) ? prev.filter(id => id !== cardId) : [...prev, cardId]
            );
        } else {
            // If already selected, don't clear others on mousedown to allow group dragging
            if (!selectedCardIds.includes(cardId)) {
                setSelectedCardIds([cardId]);
            }
        }
    };

    const addColumn = () => {
        if (!isEditable) return;
        const newId = `col-${Date.now()}`;
        updateAttributes({
            columns: [...columns, { id: newId, title: "New Column" }]
        });
    };

    const updateColumnTitle = (colId: string, title: string) => {
        if (!isEditable) return;
        updateAttributes({
            columns: columns.map(col => col.id === colId ? { ...col, title } : col)
        });
    };

    const removeColumn = (colId: string) => {
        if (!isEditable) return;
        updateAttributes({
            columns: columns.filter(col => col.id !== colId),
            cards: cards.filter(card => card.columnId !== colId)
        });
    };

    const addCard = (columnId: string) => {
        const newId = `card-${Date.now()}`;
        const newCard: KanbanCard = {
            id: newId,
            columnId,
            title: "New Task",
            content: null
        };
        updateAttributes({
            cards: [...cards, newCard]
        });
    };

    const updateCardTitle = (cardId: string, title: string) => {
        updateAttributes({
            cards: cards.map(card => card.id === cardId ? { ...card, title } : card)
        });
    };

    const removeCard = (cardIdOrIds: string | string[]) => {
        const idsToRemove = Array.isArray(cardIdOrIds) ? cardIdOrIds : [cardIdOrIds];
        updateAttributes({
            cards: cards.filter(card => !idsToRemove.includes(card.id))
        });
        setSelectedCardIds([]);
    };

    const moveCard = (cardId: string, direction: 'up' | 'down' | 'left' | 'right') => {
        const cardIndex = cards.findIndex(c => c.id === cardId);
        if (cardIndex === -1) return;

        const card = cards[cardIndex];
        const sameColCards = cards.filter(c => c.columnId === card.columnId);
        const cardInSameColIndex = sameColCards.findIndex(c => c.id === cardId);

        if (direction === 'up' && cardInSameColIndex > 0) {
            const prevCard = sameColCards[cardInSameColIndex - 1];
            const prevGlobalIndex = cards.findIndex(c => c.id === prevCard.id);
            const newCards = [...cards];
            newCards[cardIndex] = prevCard;
            newCards[prevGlobalIndex] = card;
            updateAttributes({ cards: newCards });
        } else if (direction === 'down' && cardInSameColIndex < sameColCards.length - 1) {
            const nextCard = sameColCards[cardInSameColIndex + 1];
            const nextGlobalIndex = cards.findIndex(c => c.id === nextCard.id);
            const newCards = [...cards];
            newCards[cardIndex] = nextCard;
            newCards[nextGlobalIndex] = card;
            updateAttributes({ cards: newCards });
        } else if (direction === 'left' || direction === 'right') {
            const colIndex = columns.findIndex(col => col.id === card.columnId);
            const nextColIndex = direction === 'left' ? colIndex - 1 : colIndex + 1;
            if (nextColIndex >= 0 && nextColIndex < columns.length) {
                const nextColId = columns[nextColIndex].id;
                updateAttributes({
                    cards: cards.map(c => c.id === cardId ? { ...c, columnId: nextColId } : c)
                });
            }
        }
    };

    const handleDragStart = (e: React.DragEvent, cardId: string) => {
        let idsToDrag = [cardId];
        if (selectedCardIds.includes(cardId)) {
            idsToDrag = selectedCardIds;
        } else {
            setSelectedCardIds([cardId]);
        }

        setDraggedCardId(cardId);
        e.dataTransfer.setData("cardIds", JSON.stringify(idsToDrag));
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDragOver = (e: React.DragEvent, colId: string) => {
        e.preventDefault();
        setDragOverColId(colId);
        e.dataTransfer.dropEffect = "move";
    };

    const handleDrop = (e: React.DragEvent, colId: string, targetCardId?: string) => {
        e.preventDefault();
        const cardIdsRaw = e.dataTransfer.getData("cardIds");
        const cardIds: string[] = cardIdsRaw ? JSON.parse(cardIdsRaw) : (draggedCardId ? [draggedCardId] : []);

        setDraggedCardId(null);
        setDragOverColId(null);
        setIsDragOverDelete(false);

        if (cardIds.length === 0) return;

        // Don't do anything if dropping on itself
        if (cardIds.length === 1 && cardIds[0] === targetCardId) return;

        let newCards = [...cards];
        const draggingCards = cards.filter(c => cardIds.includes(c.id));

        if (draggingCards.length === 0) return;

        // Remove dragging cards from their current positions
        newCards = newCards.filter(c => !cardIds.includes(c.id));

        // Update their column ID
        const updatedDraggingCards = draggingCards.map(c => ({ ...c, columnId: colId }));

        if (targetCardId) {
            const targetIndex = newCards.findIndex(c => c.id === targetCardId);
            newCards.splice(targetIndex, 0, ...updatedDraggingCards);
        } else {
            newCards.push(...updatedDraggingCards);
        }

        updateAttributes({ cards: newCards });
        setSelectedCardIds([]);
    };

    const handleDragEnd = () => {
        setDraggedCardId(null);
        setDragOverColId(null);
        setIsDragOverDelete(false);
    };

    const handleMouseDownBoard = (e: React.MouseEvent) => {
        // Only start selection on left click and on the board container or columns, not on cards or buttons
        if (e.button !== 0) return;

        const target = e.target as HTMLElement;
        const isAction = target.closest('button') || target.closest('a') || target.closest('input') || target.closest(`.${classes.card}`);

        if (!isAction && boardRef.current) {
            const rect = boardRef.current.getBoundingClientRect();
            const x = e.clientX - rect.left + boardRef.current.scrollLeft;
            const y = e.clientY - rect.top + boardRef.current.scrollTop;

            setSelectionBox({
                startX: x,
                startY: y,
                currentX: x,
                currentY: y
            });

            if (!e.ctrlKey && !e.metaKey) {
                setSelectedCardIds([]);
            }
        }
    };

    useEffect(() => {
        const handleGlobalMouseMove = (e: MouseEvent) => {
            if (!selectionBox || !boardRef.current) return;

            const rect = boardRef.current.getBoundingClientRect();
            const currentX = e.clientX - rect.left + boardRef.current.scrollLeft;
            const currentY = e.clientY - rect.top + boardRef.current.scrollTop;

            setSelectionBox(prev => prev ? { ...prev, currentX, currentY } : null);

            // Viewport-based overlap calculation
            const boxViewportX = Math.min(selectionBox.startX - boardRef.current.scrollLeft + rect.left, e.clientX);
            const boxViewportY = Math.min(selectionBox.startY - boardRef.current.scrollTop + rect.top, e.clientY);
            const boxViewportWidth = Math.abs((selectionBox.startX - boardRef.current.scrollLeft + rect.left) - e.clientX);
            const boxViewportHeight = Math.abs((selectionBox.startY - boardRef.current.scrollTop + rect.top) - e.clientY);

            const cardElements = boardRef.current.querySelectorAll(`.${classes.card}`);
            const newSelectedIds: string[] = [];

            cardElements.forEach(el => {
                const elRect = el.getBoundingClientRect();

                const isOverlapping = (
                    boxViewportX < elRect.right &&
                    boxViewportX + boxViewportWidth > elRect.left &&
                    boxViewportY < elRect.bottom &&
                    boxViewportY + boxViewportHeight > elRect.top
                );

                if (isOverlapping) {
                    const cardId = (el as HTMLElement).getAttribute('data-card-id');
                    if (cardId) newSelectedIds.push(cardId);
                }
            });

            setSelectedCardIds(prev => {
                if (e.ctrlKey || e.metaKey) {
                    // This is tricky for real-time toggle, maybe just union for now
                    const combined = new Set([...prev, ...newSelectedIds]);
                    return Array.from(combined);
                }
                return newSelectedIds;
            });
        };

        const handleGlobalMouseUp = () => {
            setSelectionBox(null);
        };

        if (selectionBox) {
            window.addEventListener('mousemove', handleGlobalMouseMove);
            window.addEventListener('mouseup', handleGlobalMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleGlobalMouseMove);
            window.removeEventListener('mouseup', handleGlobalMouseUp);
        };
    }, [selectionBox]);

    return (
        <NodeViewWrapper
            className={classes.kanbanBoardWrapper}
            data-read-only={!isEditable}
        >
            <ScrollArea type="always" pb="md">
                <div
                    ref={boardRef}
                    className={classes.boardContainer}
                    onMouseDown={handleMouseDownBoard}
                    style={{ position: 'relative' }}
                >
                    {selectionBox && (
                        <div
                            className={classes.selectionBox}
                            style={{
                                left: Math.min(selectionBox.startX, selectionBox.currentX),
                                top: Math.min(selectionBox.startY, selectionBox.currentY),
                                width: Math.abs(selectionBox.startX - selectionBox.currentX),
                                height: Math.abs(selectionBox.startY - selectionBox.currentY),
                            }}
                        />
                    )}
                    {columns.map((column) => {
                        const columnCards = cards.filter(card => card.columnId === column.id);
                        const isFirstColumn = column.id === columns[0].id;
                        return (
                            <div
                                key={column.id}
                                className={clsx(classes.column, dragOverColId === column.id && classes.dragOver)}
                                onDragOver={(e) => handleDragOver(e, column.id)}
                                onDrop={(e) => handleDrop(e, column.id)}
                                onDragLeave={() => setDragOverColId(null)}
                                style={{ minHeight: "50vh" }}
                            >
                                <div className={classes.columnHeader}>
                                    <Group gap={8}>
                                        <TextInput
                                            variant="unstyled"
                                            className={classes.columnTitleInput}
                                            value={column.title}
                                            onChange={(e) => updateColumnTitle(column.id, e.target.value)}
                                            readOnly={!isEditable}
                                        />
                                        <Badge variant="light" size="sm" color="gray">
                                            {columnCards.length}
                                        </Badge>
                                    </Group>
                                    {isEditable && (
                                        <Menu position="bottom-end" withinPortal={false}>
                                            <Menu.Target>
                                                <ActionIcon variant="subtle" size="sm" color="gray">
                                                    <IconDotsVertical size={16} />
                                                </ActionIcon>
                                            </Menu.Target>
                                            <Menu.Dropdown>
                                                <Menu.Item
                                                    color="red"
                                                    leftSection={<IconTrash size={14} />}
                                                    onClick={() => removeColumn(column.id)}
                                                >
                                                    Delete column
                                                </Menu.Item>
                                            </Menu.Dropdown>
                                        </Menu>
                                    )}
                                </div>

                                <div className={classes.cardsContainer}>
                                    {columnCards.map((card) => (
                                        <Paper
                                            key={card.id}
                                            data-card-id={card.id}
                                            className={clsx(
                                                classes.card,
                                                (draggedCardId === card.id || (draggedCardId && selectedCardIds.includes(draggedCardId) && selectedCardIds.includes(card.id))) && classes.isDragging,
                                                selectedCardIds.includes(card.id) && classes.isSelected
                                            )}
                                            draggable={true}
                                            onDragStart={(e) => handleDragStart(e, card.id)}
                                            onDragEnd={handleDragEnd}
                                            onDragOver={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                            }}
                                            onDrop={(e) => {
                                                e.stopPropagation();
                                                handleDrop(e, column.id, card.id);
                                            }}
                                            onMouseDown={(e) => {
                                                e.stopPropagation();
                                                toggleCardSelection(card.id, e.ctrlKey || e.metaKey);
                                            }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                // If already selected and not dragging, clicking should make it the exclusive selection
                                                if (!e.ctrlKey && !e.metaKey && selectedCardIds.includes(card.id)) {
                                                    setSelectedCardIds([card.id]);
                                                }
                                            }}
                                        >
                                            <div className={classes.cardTitle}>
                                                <Text size="sm" fw={500}>{card.title}</Text>
                                            </div>

                                            <div className={classes.cardActions} onClick={(e) => e.stopPropagation()}>
                                                <ActionIcon
                                                    variant="filled"
                                                    size="md"
                                                    radius="xl"
                                                    color="blue"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleOpenCard(card.id);
                                                    }}
                                                >
                                                    <IconEdit size={18} />
                                                </ActionIcon>
                                            </div>
                                        </Paper>
                                    ))}
                                </div>
                                {isFirstColumn ? (<Button
                                    variant="subtle"
                                    size="xs"
                                    leftSection={<IconPlus size={16} />}
                                    className={classes.addCardBtn}
                                    onClick={() => addCard(column.id)}
                                >
                                    Add card
                                </Button>) : null}

                            </div>
                        );
                    })}

                    {isEditable && (
                        <UnstyledButton className={classes.addColumnBtn} onClick={addColumn}>
                            <Group justify="center" gap={8}>
                                <IconPlus size={20} />
                                <Text size="sm" fw={500}>Add Column</Text>
                            </Group>
                        </UnstyledButton>
                    )}
                </div>
            </ScrollArea>

            <Modal
                opened={opened}
                onClose={close}
                size="70%"
                withCloseButton={false}
                styles={{
                    title: { flex: 1 }
                }}
                title={
                    <Group justify="space-between" align="center" style={{ flex: 1, width: "100%" }}>
                        <Group gap="xs">
                            <IconEdit size={18} />
                            <Text fw={600}>{activeCard?.title || "Edit Card"}</Text>
                        </Group>
                        <Group gap="xs">
                            <Button
                                color="red"
                                variant="filled"
                                size="xs"
                                onClick={() => {
                                    if (selectedCardIds.length > 0) {
                                        removeCard(selectedCardIds);
                                        close();
                                    }
                                }}
                            >
                                {selectedCardIds.length > 1 ? `Delete ${selectedCardIds.length} cards` : "Delete"}
                            </Button>
                        </Group>
                    </Group>
                }
                centered
            >
                <Stack>
                    <TextInput
                        label="Title"
                        className={classes.modalTitleInput}
                        value={activeCard?.title || ""}
                        onChange={(e) => activeCardId && updateCardTitle(activeCardId, e.target.value)}
                        readOnly={false}
                    />

                    <Box mb="md">
                        <Text size="sm" fw={500} mb={4}>Description</Text>
                        <Box ref={menuContainerRef} className={classes.modalEditorContainer} style={{ border: '1px solid var(--mantine-color-default-border)', borderRadius: 'var(--mantine-radius-sm)', minHeight: '300px' }}>
                            <EditorContent editor={cardEditor} className={classes.modalEditor} />
                            {cardEditor && (
                                <>
                                    <EditorBubbleMenu editor={cardEditor} />
                                    <TableMenu editor={cardEditor} />
                                    <TableCellMenu editor={cardEditor} appendTo={menuContainerRef} />
                                    <ImageMenu editor={cardEditor} />
                                    <VideoMenu editor={cardEditor} />
                                    <CalloutMenu editor={cardEditor} />
                                    <SubpagesMenu editor={cardEditor} />
                                    <ColumnMenu editor={cardEditor} />
                                    <ExcalidrawMenu editor={cardEditor} />
                                    <DrawioMenu editor={cardEditor} />
                                    <LinkMenu editor={cardEditor} appendTo={menuContainerRef} />
                                </>
                            )}
                        </Box>
                    </Box>
                </Stack>
            </Modal>

            {draggedCardId && (
                <div
                    className={clsx(classes.deleteArea, isDragOverDelete && classes.deleteAreaActive)}
                    onDragOver={(e) => {
                        e.preventDefault();
                        setIsDragOverDelete(true);
                    }}
                    onDragLeave={() => setIsDragOverDelete(false)}
                    onDrop={(e) => {
                        e.preventDefault();
                        const cardIdsRaw = e.dataTransfer.getData("cardIds");
                        const cardIds: string[] = cardIdsRaw ? JSON.parse(cardIdsRaw) : [];

                        if (cardIds.length > 0) {
                            removeCard(cardIds);
                        }
                        handleDragEnd();
                    }}
                >
                    <Group gap="xs" justify="center" h="100%">
                        <IconTrash size={24} color={isDragOverDelete ? "var(--mantine-color-white)" : "var(--mantine-color-red-6)"} />
                        <Text fw={600} c={isDragOverDelete ? "white" : "red"}>
                            {isDragOverDelete ? "Release to Delete" : "Drag here to delete"}
                        </Text>
                    </Group>
                </div>
            )}
        </NodeViewWrapper>
    );
}
