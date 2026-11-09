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
  Progress,
  SegmentedControl,
  Select,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { Link, useSearchParams } from "react-router-dom";
import { DocumentTitle } from "@/components/ui/document-title";
import {
  errorMessage,
  formatTime,
  ReadingBatch,
  sourceUrl,
  useCollaborationIdentity,
  useCollaborationList,
} from "./collaboration-api";
import { ReadingDetailDialog } from "./reading-detail-dialog";

export default function ReadingPage() {
  const { workspaceId, userId } = useCollaborationIdentity();
  return <ReadingContent key={`${workspaceId}:${userId}`} />;
}
function ReadingContent() {
  const [search, setSearch] = useSearchParams();
  const pageId = search.get("pageId") || undefined;
  const batchId = search.get("batchId");
  const [scope, setScope] = useState("received");
  const [status, setStatus] = useState("all");
  const query = useCollaborationList<ReadingBatch>("reading/list", {
    pageId,
    scope,
    status,
  });
  const items = query.data?.pages.flatMap((p) => p.items) || [];
  return (
    <Container size="1100" py="xl">
      <DocumentTitle title="阅读确认" />
      <Stack gap="lg">
        <Group justify="space-between">
          <Title order={2}>{pageId ? "本文阅读确认" : "阅读确认"}</Title>
          <Button
            variant="default"
            onClick={() => query.refetch()}
            loading={query.isRefetching}
          >
            刷新
          </Button>
        </Group>
        <Text c="dimmed">对固定版本主动确认，区分“收到提醒”和“确认要求”。</Text>
        <Group justify="space-between">
          {pageId ? (
            <Button variant="subtle" onClick={() => setSearch({})}>
              返回我的全部批次
            </Button>
          ) : (
            <SegmentedControl
              value={scope}
              onChange={(v) => {
                setScope(v);
                setStatus("all");
              }}
              data={[
                { value: "received", label: "我收到的" },
                { value: "created", label: "我发起的" },
              ]}
            />
          )}
          <Select
            aria-label="确认状态"
            value={status}
            onChange={(v) => setStatus(v || "all")}
            allowDeselect={false}
            w={180}
            data={[
              { value: "all", label: "全部状态" },
              ...(scope === "received" && !pageId
                ? [
                    { value: "pending", label: "待我确认" },
                    { value: "confirmed", label: "我已确认" },
                  ]
                : []),
              { value: "open", label: "进行中" },
              { value: "closed", label: "已结束" },
              { value: "revoked", label: "已撤销" },
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
                  当前没有符合条件的确认批次。可从文档的“协作事项”发起。
                </Text>
              </Paper>
            )}
            {items.map((batch) => (
              <Paper
                key={batch.id}
                withBorder
                p="lg"
                data-testid="reading-batch-card"
              >
                <Stack gap="sm">
                  <Group justify="space-between" align="flex-start">
                    <Text
                      fw={600}
                      style={{ flex: 1, overflowWrap: "anywhere" }}
                    >
                      {batch.title}
                    </Text>
                    <Badge color={batch.status === "open" ? "blue" : "gray"}>
                      {
                        { open: "进行中", closed: "已结束", revoked: "已撤销" }[
                          batch.status
                        ]
                      }
                    </Badge>
                  </Group>
                  {batch.page && (
                    <Anchor component={Link} to={sourceUrl(batch.page)}>
                      源文档：{batch.page.title || "无标题文档"}
                    </Anchor>
                  )}
                  <Text size="sm" c="dimmed">
                    发起人：{batch.creator?.name || "成员已移除"}　发布于：
                    {formatTime(batch.createdAt)}
                  </Text>
                  {batch.canManage && (
                    <>
                      <Text size="sm">
                        已确认 {batch.confirmed} / {batch.total}
                      </Text>
                      <Progress
                        value={
                          batch.total
                            ? (batch.confirmed! / batch.total) * 100
                            : 0
                        }
                      />
                    </>
                  )}
                  <Group justify="space-between">
                    <Text
                      size="sm"
                      c={batch.myConfirmedAt ? "green" : "dimmed"}
                    >
                      {batch.isRecipient
                        ? batch.myConfirmedAt
                          ? `我已确认：${formatTime(batch.myConfirmedAt)}`
                          : "我尚未确认"
                        : "我发起的批次"}
                    </Text>
                    <Button
                      variant="light"
                      onClick={() => {
                        const next = new URLSearchParams(search);
                        next.set("batchId", batch.id);
                        setSearch(next);
                      }}
                    >
                      查看固定内容与确认
                    </Button>
                  </Group>
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
      {batchId && (
        <ReadingDetailDialog
          key={batchId}
          batchId={batchId}
          onClose={() => {
            const next = new URLSearchParams(search);
            next.delete("batchId");
            setSearch(next);
          }}
        />
      )}
    </Container>
  );
}
