import { useState } from "react";
import {
  Alert,
  Anchor,
  Badge,
  Button,
  Checkbox,
  Group,
  Loader,
  Modal,
  Progress,
  Stack,
  Table,
  Text,
} from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { modals } from "@mantine/modals";
import { Link } from "react-router-dom";
import {
  collaborationPost,
  errorMessage,
  formatTime,
  ReadingBatch,
  sourceUrl,
  useCollaborationAction,
  useCollaborationIdentity,
} from "./collaboration-api";
import { SnapshotContent } from "./snapshot-content";

export function ReadingDetailDialog({
  batchId,
  onClose,
}: {
  batchId: string;
  onClose: () => void;
}) {
  const identity = useCollaborationIdentity();
  const [checked, setChecked] = useState(false);
  const query = useQuery({
    queryKey: [
      "document-collaboration",
      identity.workspaceId,
      identity.userId,
      "reading-info",
      batchId,
    ],
    queryFn: () => collaborationPost<ReadingBatch>("reading/info", { batchId }),
    refetchInterval: 15000,
    staleTime: 0,
    gcTime: 0,
  });
  const action = useCollaborationAction();
  const batch = query.data;
  function closeBatch(revoke: boolean) {
    modals.openConfirmModal({
      title: revoke ? "撤销确认批次" : "结束确认批次",
      children: (
        <Text>
          操作后将停止接收新的确认，已发布内容和已有确认记录继续保留。
        </Text>
      ),
      labels: { confirm: revoke ? "撤销批次" : "结束批次", cancel: "返回" },
      confirmProps: { color: revoke ? "red" : "blue" },
      onConfirm: () =>
        action.mutate({
          path: revoke ? "reading/revoke" : "reading/close",
          body: { batchId },
        }),
    });
  }
  return (
    <Modal
      opened
      onClose={onClose}
      title={batch?.title || "阅读确认详情"}
      size="1000"
      centered
    >
      {query.isPending ? (
        <Loader />
      ) : query.isError ? (
        <Alert color="red">{errorMessage(query.error)}</Alert>
      ) : (
        batch && (
          <Stack>
            <Group justify="space-between">
              <Badge color={batch.status === "open" ? "blue" : "gray"}>
                {
                  { open: "进行中", closed: "已结束", revoked: "已撤销" }[
                    batch.status
                  ]
                }
              </Badge>
              <Text size="sm" c="dimmed">
                发布于 {formatTime(batch.createdAt)}
              </Text>
            </Group>
            <Text size="sm" c="dimmed">
              发起人：{batch.creator?.name || "成员已移除"}
            </Text>
            {batch.page && (
              <Anchor
                component={Link}
                to={sourceUrl(batch.page)}
                onClick={onClose}
              >
                打开当前源文档：{batch.page.title || "无标题文档"}
              </Anchor>
            )}
            <Alert color="blue">
              以下为本批次发布时保存的内容，源文档后续编辑不会覆盖它。打开通知或标记消息已读，不会自动完成阅读确认。
            </Alert>
            {batch.snapshot && (
              <>
                <Text size="sm" c="dimmed">
                  来源正文保存时间：{formatTime(batch.snapshot.sourceUpdatedAt)}
                </Text>
                <SnapshotContent snapshot={batch.snapshot} />
              </>
            )}
            <Text size="sm" c="dimmed">
              确认范围为本批次保存的标题与正文；附件、嵌入页面和外部内容不随批次固定。
            </Text>
            {batch.isRecipient &&
              (batch.myConfirmedAt ? (
                <Alert color="green">
                  你已于 {formatTime(batch.myConfirmedAt)} 主动确认本批次内容。
                </Alert>
              ) : batch.status === "open" ? (
                <>
                  <Checkbox
                    checked={checked}
                    onChange={(e) => setChecked(e.currentTarget.checked)}
                    label="我已阅读以上固定内容，确认本次发布的要求"
                  />
                  <Group justify="flex-end">
                    <Button
                      disabled={!checked}
                      loading={action.isPending}
                      onClick={() =>
                        action.mutate(
                          {
                            path: "reading/confirm",
                            body: { batchId, acknowledged: true },
                          },
                          { onSuccess: () => setChecked(false) },
                        )
                      }
                    >
                      确认已阅读
                    </Button>
                  </Group>
                </>
              ) : (
                <Alert color="gray">
                  本批次已结束或已撤销，不能继续提交确认。
                </Alert>
              ))}
            {batch.canManage && (
              <>
                <Text fw={600}>
                  确认进度：{batch.confirmed} / {batch.total}
                </Text>
                <Progress
                  value={
                    batch.total ? (batch.confirmed! / batch.total) * 100 : 0
                  }
                />
                <Table.ScrollContainer minWidth={460}>
                  <Table>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>接收人</Table.Th>
                        <Table.Th>状态</Table.Th>
                        <Table.Th>本人确认时间</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {batch.recipients?.map((r) => (
                        <Table.Tr key={r.id}>
                          <Table.Td>
                            {r.name || "未命名成员"}
                            {!r.userId && "（成员已移除）"}
                          </Table.Td>
                          <Table.Td>
                            {r.confirmedAt ? "已确认" : "待确认"}
                          </Table.Td>
                          <Table.Td>
                            {r.confirmedAt ? formatTime(r.confirmedAt) : "—"}
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
                {batch.status === "open" && (
                  <Group justify="flex-end">
                    <Button
                      variant="subtle"
                      color="red"
                      disabled={action.isPending}
                      onClick={() => closeBatch(true)}
                    >
                      撤销批次
                    </Button>
                    <Button
                      variant="default"
                      disabled={action.isPending}
                      onClick={() => closeBatch(false)}
                    >
                      结束批次
                    </Button>
                  </Group>
                )}
              </>
            )}
          </Stack>
        )
      )}
    </Modal>
  );
}
