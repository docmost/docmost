import { useState } from "react";
import {
  Alert,
  Anchor,
  Badge,
  Button,
  Container,
  Group,
  Loader,
  Paper,
  SegmentedControl,
  Select,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { modals } from "@mantine/modals";
import { Link, useSearchParams } from "react-router-dom";
import { DocumentTitle } from "@/components/ui/document-title";
import {
  DocumentTask,
  errorMessage,
  formatTime,
  sourceUrl,
  useCollaborationAction,
  useCollaborationIdentity,
  useCollaborationList,
} from "./collaboration-api";
import { TaskDialog } from "./task-dialog";

export default function TasksPage() {
  const { workspaceId, userId } = useCollaborationIdentity();
  return <TasksContent key={`${workspaceId}:${userId}`} />;
}
function TasksContent() {
  const [search, setSearch] = useSearchParams();
  const pageId = search.get("pageId") || undefined;
  const [scope, setScope] = useState("assigned");
  const [status, setStatus] = useState("pending");
  const [editing, setEditing] = useState<DocumentTask | null>(null);
  const query = useCollaborationList<DocumentTask>("tasks/list", {
    pageId,
    scope,
    status,
  });
  const action = useCollaborationAction();
  const items = query.data?.pages.flatMap((p) => p.items) || [];
  return (
    <Container size="1100" py="xl">
      <DocumentTitle title="我的待办" />
      <Stack gap="lg">
        <Group justify="space-between">
          <Title order={2}>{pageId ? "本文关联待办" : "我的待办"}</Title>
          <Button
            variant="default"
            onClick={() => query.refetch()}
            loading={query.isRefetching}
          >
            刷新
          </Button>
        </Group>
        <Text c="dimmed">
          从文档分配工作，在这里集中查看负责人、截止时间和办理状态。
        </Text>
        <Group justify="space-between">
          {pageId ? (
            <Button variant="subtle" onClick={() => setSearch({})}>
              返回我的全部待办
            </Button>
          ) : (
            <SegmentedControl
              value={scope}
              onChange={value => setScope(String(value))}
              data={[
                { value: "assigned", label: "分配给我" },
                { value: "created", label: "我创建的" },
              ]}
            />
          )}
          <Select
            aria-label="待办状态"
            value={status}
            onChange={(v) => setStatus(v || "all")}
            allowDeselect={false}
            w={180}
            data={[
              { value: "pending", label: "待办" },
              { value: "overdue", label: "已逾期" },
              { value: "completed", label: "已完成" },
              { value: "cancelled", label: "已取消" },
              { value: "all", label: "全部状态" },
            ]}
          />
        </Group>
        {query.isPending ? (
          <Loader />
        ) : query.isError ? (
          <Alert color="red">{errorMessage(query.error)}</Alert>
        ) : (
          <>
            {!items.length && (
              <Paper withBorder p="xl">
                <Text ta="center" c="dimmed">
                  当前没有符合条件的待办。打开一篇可编辑文档，在“协作事项”中创建。
                </Text>
              </Paper>
            )}
            {items.map((task) => (
              <Paper
                key={task.id}
                withBorder
                p="lg"
                data-testid="document-task-card"
              >
                <Stack gap="sm">
                  <Group justify="space-between" align="flex-start">
                    <Text
                      fw={600}
                      style={{ overflowWrap: "anywhere", flex: 1 }}
                    >
                      {task.title}
                    </Text>
                    <Group gap="xs">
                      <Badge
                        color={
                          task.status === "completed"
                            ? "green"
                            : task.status === "cancelled"
                              ? "gray"
                              : "blue"
                        }
                      >
                        {
                          {
                            pending: "待办",
                            completed: "已完成",
                            cancelled: "已取消",
                          }[task.status]
                        }
                      </Badge>
                      {task.overdue && <Badge color="red">已逾期</Badge>}
                    </Group>
                  </Group>
                  {task.page && (
                    <Anchor component={Link} to={sourceUrl(task.page)}>
                      源文档：{task.page.title || "无标题文档"}
                    </Anchor>
                  )}
                  <Text size="sm" c="dimmed">
                    负责人：{task.assignee?.name || "成员已移除"}　创建者：
                    {task.creator?.name || "成员已移除"}
                  </Text>
                  <Text size="sm" c="dimmed">
                    截止时间：{formatTime(task.dueAt)}
                    {task.completedAt &&
                      `　完成时间：${formatTime(task.completedAt)}`}
                  </Text>
                  {task.status === "pending" && (
                    <Group justify="flex-end">
                      {task.canManage && (
                        <>
                          <Button
                            variant="default"
                            size="sm"
                            disabled={action.isPending}
                            onClick={() => setEditing(task)}
                          >
                            修改
                          </Button>
                          <Button
                            color="red"
                            variant="subtle"
                            size="sm"
                            disabled={action.isPending}
                            onClick={() =>
                              modals.openConfirmModal({
                                title: "取消待办",
                                children: (
                                  <Text>
                                    取消“{task.title}
                                    ”后将保留记录，首版不支持重新打开。
                                  </Text>
                                ),
                                labels: {
                                  confirm: "取消此待办",
                                  cancel: "返回",
                                },
                                confirmProps: { color: "red" },
                                onConfirm: () =>
                                  action.mutate({
                                    path: "tasks/cancel",
                                    body: { taskId: task.id },
                                  }),
                              })
                            }
                          >
                            取消待办
                          </Button>
                        </>
                      )}
                      {task.canComplete && (
                        <Button
                          size="sm"
                          loading={action.isPending}
                          onClick={() =>
                            action.mutate({
                              path: "tasks/complete",
                              body: { taskId: task.id },
                            })
                          }
                        >
                          标记完成
                        </Button>
                      )}
                    </Group>
                  )}
                </Stack>
              </Paper>
            ))}
            {query.hasNextPage && (
              <Button
                variant="default"
                onClick={() => query.fetchNextPage()}
                loading={query.isFetchingNextPage}
              >
                加载更多
              </Button>
            )}
          </>
        )}
      </Stack>
      {editing && (
        <TaskDialog
          key={editing.id}
          pageId={editing.pageId}
          task={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </Container>
  );
}
