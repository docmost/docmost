import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActionIcon,
  Avatar,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Menu,
  Modal,
  Select,
  Stack,
  TagsInput,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import {
  IconArrowLeft,
  IconArrowRight,
  IconCalendar,
  IconDots,
  IconEdit,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { useNavigate, useParams } from "react-router-dom";
import {
  draggable,
  dropTargetForElements,
  monitorForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import {
  attachClosestEdge,
  extractClosestEdge,
} from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import {
  announce,
  cleanup,
} from "@atlaskit/pragmatic-drag-and-drop-live-region";
import { generateJitteredKeyBetween } from "fractional-indexing-jittered";
import {
  useGetSpaceBySlugQuery,
  useSpaceMembersInfiniteQuery,
} from "@/features/space/queries/space-query.ts";
import { useSpaceAbility } from "@/features/space/permissions/use-space-ability.ts";
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from "@/features/space/permissions/permissions.type.ts";
import {
  useBoardQuery,
  useCreateCardMutation,
  useCreateColumnMutation,
  useDeleteBoardMutation,
  useDeleteCardMutation,
  useDeleteColumnMutation,
  useMoveCardMutation,
  useMoveColumnMutation,
  useUpdateBoardMutation,
  useUpdateCardMutation,
  useUpdateColumnMutation,
} from "../queries/kanban-query.ts";
import {
  IKanbanBoard,
  IKanbanCard,
  IKanbanColumn,
  KanbanPriority,
} from "../types/kanban.types.ts";
import classes from "./kanban-board.module.css";
import { Error404 } from "@/components/ui/error-404.tsx";
import { KanbanErrorBoundary } from "../components/kanban-error-boundary.tsx";

type DragData = {
  type: "kanban-card" | "kanban-column";
  cardId?: string;
  columnId: string;
};

export default function KanbanBoardPage() {
  const { spaceSlug, boardId } = useParams();
  return (
    <KanbanErrorBoundary resetKeys={[spaceSlug, boardId]}>
      <KanbanBoardContent />
    </KanbanErrorBoundary>
  );
}

function KanbanBoardContent() {
  const { spaceSlug, boardId } = useParams();
  const navigate = useNavigate();
  const { data: space } = useGetSpaceBySlugQuery(spaceSlug!);
  const { data: board, isLoading, isError } = useBoardQuery(boardId);
  const ability = useSpaceAbility(space?.membership?.permissions);
  const canWrite = ability.can(SpaceCaslAction.Manage, SpaceCaslSubject.Page);
  const canAdmin = ability.can(
    SpaceCaslAction.Manage,
    SpaceCaslSubject.Settings,
  );
  const createColumn = useCreateColumnMutation();
  const moveColumn = useMoveColumnMutation();
  const updateBoard = useUpdateBoardMutation();
  const deleteBoard = useDeleteBoardMutation();
  const moveCard = useMoveCardMutation();
  const [columnModalOpen, setColumnModalOpen] = useState(false);
  const [columnName, setColumnName] = useState("");
  const [cardModal, setCardModal] = useState<{
    card?: IKanbanCard;
    columnId: string;
  } | null>(null);
  const [titleModalOpen, setTitleModalOpen] = useState(false);
  const [boardTitle, setBoardTitle] = useState("");

  const columns = useMemo(
    () => [...(board?.columns ?? [])].sort(byPosition),
    [board?.columns],
  );

  useEffect(() => {
    if (!canWrite || !board) return;
    return monitorForElements({
      canMonitor: ({ source }) => source.data.type === "kanban-card",
      onDrop: ({ source, location }) => {
        const sourceData = source.data as DragData;
        const target = location.current.dropTargets[0];
        if (!target || !sourceData.cardId) return;
        const targetData = target.data as DragData;
        const targetColumnId = targetData.columnId;
        const orderedCards = board.cards
          .filter(
            (card) =>
              card.columnId === targetColumnId && card.id !== sourceData.cardId,
          )
          .sort(byPosition);

        let insertAt = orderedCards.length;
        if (targetData.type === "kanban-card" && targetData.cardId) {
          const targetIndex = orderedCards.findIndex(
            (card) => card.id === targetData.cardId,
          );
          const edge = extractClosestEdge(target.data);
          insertAt = Math.max(0, targetIndex + (edge === "bottom" ? 1 : 0));
        }
        const lower = orderedCards[insertAt - 1]?.position ?? null;
        const upper = orderedCards[insertAt]?.position ?? null;
        const position = generateJitteredKeyBetween(lower, upper);
        moveCard.mutate({
          boardId: board.id,
          cardId: sourceData.cardId,
          columnId: targetColumnId,
          position,
        });
        announce(
          `Card moved to ${columns.find((column) => column.id === targetColumnId)?.name ?? "column"}`,
        );
      },
    });
  }, [board, canWrite, columns, moveCard]);

  useEffect(() => cleanup, []);

  if (isError) return <Error404 />;

  if (isLoading || !space || !board) {
    return (
      <Group justify="center" py="xl">
        <Loader />
      </Group>
    );
  }

  const addColumn = () => {
    const last = columns.at(-1);
    createColumn.mutate(
      {
        boardId: board.id,
        name: columnName.trim(),
        position: generateJitteredKeyBetween(last?.position ?? null, null),
      },
      {
        onSuccess: () => {
          setColumnName("");
          setColumnModalOpen(false);
        },
      },
    );
  };

  const moveColumnBy = (column: IKanbanColumn, delta: number) => {
    const currentIndex = columns.findIndex((item) => item.id === column.id);
    const desiredIndex = currentIndex + delta;
    if (desiredIndex < 0 || desiredIndex >= columns.length) return;
    const without = columns.filter((item) => item.id !== column.id);
    const lower = without[desiredIndex - 1]?.position ?? null;
    const upper = without[desiredIndex]?.position ?? null;
    moveColumn.mutate({
      boardId: board.id,
      columnId: column.id,
      position: generateJitteredKeyBetween(lower, upper),
    });
  };

  return (
    <div className={classes.boardPage}>
      <Group justify="space-between" mb="lg" wrap="nowrap">
        <Group gap="xs" wrap="nowrap">
          <Title order={1} lineClamp={1}>
            {board.title}
          </Title>
          {canAdmin && (
            <ActionIcon
              variant="subtle"
              aria-label="Rename board"
              onClick={() => {
                setBoardTitle(board.title);
                setTitleModalOpen(true);
              }}
            >
              <IconEdit size={18} />
            </ActionIcon>
          )}
        </Group>
        <Group wrap="nowrap">
          {canAdmin && (
            <Button
              variant="default"
              leftSection={<IconPlus size={16} />}
              onClick={() => setColumnModalOpen(true)}
            >
              Add column
            </Button>
          )}
          {canAdmin && (
            <ActionIcon
              color="red"
              variant="subtle"
              aria-label="Delete board"
              onClick={() => {
                if (
                  !window.confirm(
                    `Delete “${board.title}” and all of its cards?`,
                  )
                )
                  return;
                deleteBoard.mutate(board.id, {
                  onSuccess: () => navigate(`/s/${space.slug}/boards`),
                });
              }}
            >
              <IconTrash size={18} />
            </ActionIcon>
          )}
        </Group>
      </Group>

      <div className={classes.boardScroller}>
        <div className={classes.columns}>
          {columns.map((column, index) => (
            <KanbanColumnView
              key={column.id}
              board={board}
              column={column}
              canWrite={canWrite}
              canAdmin={canAdmin}
              canMoveLeft={index > 0}
              canMoveRight={index < columns.length - 1}
              onMove={(delta) => moveColumnBy(column, delta)}
              onOpenCard={(card) => setCardModal({ card, columnId: column.id })}
              onAddCard={() => setCardModal({ columnId: column.id })}
            />
          ))}
        </div>
      </div>

      <Modal
        opened={columnModalOpen}
        onClose={() => setColumnModalOpen(false)}
        title="Add column"
      >
        <TextInput
          label="Name"
          value={columnName}
          maxLength={80}
          autoFocus
          onChange={(event) => setColumnName(event.currentTarget.value)}
          onKeyDown={(event) =>
            event.key === "Enter" && columnName.trim() && addColumn()
          }
        />
        <Group justify="flex-end" mt="lg">
          <Button variant="default" onClick={() => setColumnModalOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={!columnName.trim()}
            loading={createColumn.isPending}
            onClick={addColumn}
          >
            Add
          </Button>
        </Group>
      </Modal>

      <Modal
        opened={titleModalOpen}
        onClose={() => setTitleModalOpen(false)}
        title="Rename board"
      >
        <TextInput
          label="Title"
          value={boardTitle}
          maxLength={120}
          autoFocus
          onChange={(event) => setBoardTitle(event.currentTarget.value)}
        />
        <Group justify="flex-end" mt="lg">
          <Button variant="default" onClick={() => setTitleModalOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={!boardTitle.trim()}
            loading={updateBoard.isPending}
            onClick={() =>
              updateBoard.mutate(
                { boardId: board.id, title: boardTitle.trim() },
                { onSuccess: () => setTitleModalOpen(false) },
              )
            }
          >
            Save
          </Button>
        </Group>
      </Modal>

      {cardModal && (
        <CardEditorModal
          board={board}
          spaceId={space.id}
          value={cardModal.card}
          columnId={cardModal.columnId}
          opened
          onClose={() => setCardModal(null)}
        />
      )}
    </div>
  );
}

function KanbanColumnView({
  board,
  column,
  canWrite,
  canAdmin,
  canMoveLeft,
  canMoveRight,
  onMove,
  onOpenCard,
  onAddCard,
}: {
  board: IKanbanBoard;
  column: IKanbanColumn;
  canWrite: boolean;
  canAdmin: boolean;
  canMoveLeft: boolean;
  canMoveRight: boolean;
  onMove: (delta: number) => void;
  onOpenCard: (card: IKanbanCard) => void;
  onAddCard: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const updateColumn = useUpdateColumnMutation();
  const deleteColumn = useDeleteColumnMutation();
  const cards = board.cards
    .filter((card) => card.columnId === column.id)
    .sort(byPosition);

  useEffect(() => {
    const element = ref.current;
    if (!element || !canWrite) return;
    return dropTargetForElements({
      element,
      getData: () =>
        ({ type: "kanban-column", columnId: column.id }) satisfies DragData,
    });
  }, [canWrite, column.id]);

  const rename = () => {
    const name = window.prompt("Column name", column.name)?.trim();
    if (name)
      updateColumn.mutate({ boardId: board.id, columnId: column.id, name });
  };

  return (
    <Card ref={ref} withBorder padding="sm" className={classes.column}>
      <Group justify="space-between" wrap="nowrap" mb="sm">
        <Group gap="xs" wrap="nowrap">
          <Text fw={600} lineClamp={1}>
            {column.name}
          </Text>
          <Badge variant="light" size="sm">
            {cards.length}
          </Badge>
        </Group>
        {canAdmin && (
          <Menu position="bottom-end" withinPortal>
            <Menu.Target>
              <ActionIcon
                variant="subtle"
                aria-label={`Actions for ${column.name}`}
              >
                <IconDots size={17} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item leftSection={<IconEdit size={15} />} onClick={rename}>
                Rename
              </Menu.Item>
              <Menu.Item
                disabled={!canMoveLeft}
                leftSection={<IconArrowLeft size={15} />}
                onClick={() => onMove(-1)}
              >
                Move left
              </Menu.Item>
              <Menu.Item
                disabled={!canMoveRight}
                leftSection={<IconArrowRight size={15} />}
                onClick={() => onMove(1)}
              >
                Move right
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item
                color="red"
                leftSection={<IconTrash size={15} />}
                onClick={() => {
                  if (
                    window.confirm(`Delete the empty column “${column.name}”?`)
                  ) {
                    deleteColumn.mutate({
                      boardId: board.id,
                      columnId: column.id,
                    });
                  }
                }}
              >
                Delete
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        )}
      </Group>

      <Stack gap="sm" className={classes.cardList}>
        {cards.map((card) => (
          <KanbanCardView
            key={card.id}
            card={card}
            canWrite={canWrite}
            onOpen={() => onOpenCard(card)}
          />
        ))}
      </Stack>
      {canWrite && (
        <Button
          mt="sm"
          variant="subtle"
          color="gray"
          leftSection={<IconPlus size={15} />}
          onClick={onAddCard}
        >
          Add card
        </Button>
      )}
    </Card>
  );
}

function KanbanCardView({
  card,
  canWrite,
  onOpen,
}: {
  card: IKanbanCard;
  canWrite: boolean;
  onOpen: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || !canWrite) return;
    const cleanupDrag = draggable({
      element,
      getInitialData: () =>
        ({
          type: "kanban-card",
          cardId: card.id,
          columnId: card.columnId,
        }) satisfies DragData,
      onDragStart: () => setDragging(true),
      onDrop: () => setDragging(false),
    });
    const cleanupDrop = dropTargetForElements({
      element,
      getData: ({ input, element }) =>
        attachClosestEdge(
          {
            type: "kanban-card",
            cardId: card.id,
            columnId: card.columnId,
          } satisfies DragData,
          { input, element, allowedEdges: ["top", "bottom"] },
        ),
    });
    return () => {
      cleanupDrag();
      cleanupDrop();
    };
  }, [canWrite, card.columnId, card.id]);

  return (
    <Card
      ref={ref}
      withBorder
      padding="sm"
      className={`${classes.card} ${dragging ? classes.dragging : ""}`}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(event) =>
        (event.key === "Enter" || event.key === " ") && onOpen()
      }
    >
      <Text size="sm" fw={500}>
        {card.title}
      </Text>
      {(card.priority || card.dueDate || card.assigneeName) && (
        <Group gap="xs" mt="xs">
          {card.priority && (
            <Badge size="xs" color={priorityColor(card.priority)}>
              {card.priority}
            </Badge>
          )}
          {card.dueDate && (
            <Group gap={3} wrap="nowrap">
              <IconCalendar size={12} />
              <Text size="xs" c="dimmed">
                {card.dueDate.slice(0, 10)}
              </Text>
            </Group>
          )}
          {card.assigneeName && (
            <Avatar
              src={card.assigneeAvatarUrl}
              name={card.assigneeName}
              size={20}
            />
          )}
        </Group>
      )}
      {card.labels.length > 0 && (
        <Group gap={4} mt="xs">
          {card.labels.map((label) => (
            <Badge key={label} size="xs" variant="outline">
              {label}
            </Badge>
          ))}
        </Group>
      )}
    </Card>
  );
}

function CardEditorModal({
  board,
  spaceId,
  value,
  columnId,
  opened,
  onClose,
}: {
  board: IKanbanBoard;
  spaceId: string;
  value?: IKanbanCard;
  columnId: string;
  opened: boolean;
  onClose: () => void;
}) {
  const createCard = useCreateCardMutation();
  const updateCard = useUpdateCardMutation();
  const deleteCard = useDeleteCardMutation();
  const membersQuery = useSpaceMembersInfiniteQuery(spaceId);
  const [title, setTitle] = useState(value?.title ?? "");
  const [description, setDescription] = useState(value?.description ?? "");
  const [priority, setPriority] = useState<string | null>(
    value?.priority ?? null,
  );
  const [dueDate, setDueDate] = useState(value?.dueDate?.slice(0, 10) ?? "");
  const [labels, setLabels] = useState<string[]>(value?.labels ?? []);
  const [assigneeId, setAssigneeId] = useState<string | null>(
    value?.assigneeId ?? null,
  );
  const members =
    membersQuery.data?.pages
      .flatMap((page) => page.items)
      .filter((member) => member.type === "user") ?? [];

  const minDueDate = "2000-01-01";
  const maxDueDate = (() => {
    const date = new Date();
    date.setFullYear(date.getFullYear() + 5);
    return date.toISOString().slice(0, 10);
  })();

  const submit = () => {
    if (!title.trim()) return;
    const common = {
      boardId: board.id,
      title: title.trim(),
      description: description || null,
      priority: (priority as KanbanPriority | null) ?? null,
      dueDate: dueDate || null,
      labels,
      assigneeId,
    };
    if (value) {
      updateCard.mutate(
        { ...common, cardId: value.id },
        { onSuccess: onClose },
      );
      return;
    }
    const last = board.cards
      .filter((card) => card.columnId === columnId)
      .sort(byPosition)
      .at(-1);
    createCard.mutate(
      {
        ...common,
        columnId,
        position: generateJitteredKeyBetween(last?.position ?? null, null),
      },
      { onSuccess: onClose },
    );
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={value ? "Edit card" : "New card"}
      size="lg"
    >
      <Stack>
        <TextInput
          label="Title"
          value={title}
          maxLength={200}
          autoFocus
          onChange={(event) => setTitle(event.currentTarget.value)}
        />
        <Textarea
          label="Description"
          value={description}
          maxLength={10_000}
          minRows={4}
          autosize
          onChange={(event) => setDescription(event.currentTarget.value)}
        />
        <Group grow align="start">
          <Select
            label="Priority"
            clearable
            value={priority}
            onChange={(next) =>
              setPriority(next === null ? null : String(next))
            }
            data={["low", "medium", "high", "urgent"]}
          />
          <TextInput
            label="Due date"
            type="date"
            value={dueDate}
            min={minDueDate}
            max={maxDueDate}
            onChange={(event) => setDueDate(event.currentTarget.value)}
          />
        </Group>
        <Select
          label="Assignee"
          clearable
          searchable
          value={assigneeId}
          onChange={(next) =>
            setAssigneeId(next === null ? null : String(next))
          }
          data={members.map((member) => ({
            value: member.id,
            label: member.name,
          }))}
        />
        <TagsInput
          label="Labels"
          value={labels}
          onChange={setLabels}
          maxTags={10}
          maxLength={30}
        />
        <Group justify="space-between">
          {value ? (
            <Button
              color="red"
              variant="subtle"
              leftSection={<IconTrash size={16} />}
              loading={deleteCard.isPending}
              onClick={() => {
                if (window.confirm(`Delete “${value.title}”?`)) {
                  deleteCard.mutate(
                    { boardId: board.id, cardId: value.id },
                    { onSuccess: onClose },
                  );
                }
              }}
            >
              Delete
            </Button>
          ) : (
            <span />
          )}
          <Group>
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button
              disabled={!title.trim()}
              loading={createCard.isPending || updateCard.isPending}
              onClick={submit}
            >
              Save
            </Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}

function byPosition<T extends { position: string; id: string }>(
  a: T,
  b: T,
): number {
  return a.position.localeCompare(b.position) || a.id.localeCompare(b.id);
}

function priorityColor(priority: KanbanPriority): string {
  return { low: "gray", medium: "blue", high: "orange", urgent: "red" }[
    priority
  ];
}
