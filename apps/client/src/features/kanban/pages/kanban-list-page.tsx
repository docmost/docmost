import { useState } from "react";
import {
  Button,
  Card,
  Container,
  Group,
  Modal,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { IconLayoutKanban, IconPlus } from "@tabler/icons-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useGetSpaceBySlugQuery } from "@/features/space/queries/space-query.ts";
import { useSpaceAbility } from "@/features/space/permissions/use-space-ability.ts";
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from "@/features/space/permissions/permissions.type.ts";
import {
  useBoardsQuery,
  useCreateBoardMutation,
} from "../queries/kanban-query.ts";
import { KanbanErrorBoundary } from "../components/kanban-error-boundary.tsx";

export default function KanbanListPage() {
  const { spaceSlug } = useParams();
  return (
    <KanbanErrorBoundary resetKeys={[spaceSlug]}>
      <KanbanListContent />
    </KanbanErrorBoundary>
  );
}

function KanbanListContent() {
  const { spaceSlug } = useParams();
  const navigate = useNavigate();
  const { data: space } = useGetSpaceBySlugQuery(spaceSlug!);
  const { data: boards = [], isLoading } = useBoardsQuery(space?.id);
  const ability = useSpaceAbility(space?.membership?.permissions);
  const canManage = ability.can(
    SpaceCaslAction.Manage,
    SpaceCaslSubject.Settings,
  );
  const createBoard = useCreateBoardMutation();
  const [opened, setOpened] = useState(false);
  const [title, setTitle] = useState("");

  const submit = () => {
    if (!space || !title.trim()) return;
    createBoard.mutate(
      { spaceId: space.id, title: title.trim() },
      {
        onSuccess: (board) => {
          setOpened(false);
          setTitle("");
          navigate(`/s/${space.slug}/boards/${board.id}`);
        },
      },
    );
  };

  return (
    <Container size="xl" py="xl">
      <Group justify="space-between" mb="xl">
        <div>
          <Title order={1}>Boards</Title>
          <Text c="dimmed">Track support work across this space.</Text>
        </div>
        {canManage && (
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => setOpened(true)}
          >
            New board
          </Button>
        )}
      </Group>

      {!isLoading && boards.length === 0 ? (
        <Card withBorder p="xl">
          <Stack align="center" gap="sm">
            <IconLayoutKanban size={36} />
            <Text fw={600}>No boards yet</Text>
            <Text c="dimmed" ta="center">
              Create a board to organize incoming requests and follow-up work.
            </Text>
          </Stack>
        </Card>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
          {boards.map((board) => (
            <Card
              key={board.id}
              component={Link}
              to={`/s/${spaceSlug}/boards/${board.id}`}
              withBorder
              padding="lg"
              style={{ color: "inherit", textDecoration: "none" }}
            >
              <Group wrap="nowrap">
                <IconLayoutKanban size={22} />
                <Text fw={600} lineClamp={2}>
                  {board.title}
                </Text>
              </Group>
            </Card>
          ))}
        </SimpleGrid>
      )}

      <Modal opened={opened} onClose={() => setOpened(false)} title="New board">
        <TextInput
          label="Board title"
          value={title}
          onChange={(event) => setTitle(event.currentTarget.value)}
          maxLength={120}
          autoFocus
          onKeyDown={(event) => event.key === "Enter" && submit()}
        />
        <Group justify="flex-end" mt="lg">
          <Button variant="default" onClick={() => setOpened(false)}>
            Cancel
          </Button>
          <Button
            loading={createBoard.isPending}
            disabled={!title.trim()}
            onClick={submit}
          >
            Create
          </Button>
        </Group>
      </Modal>
    </Container>
  );
}
