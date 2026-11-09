import { useState } from "react";
import {
  Alert,
  Button,
  Checkbox,
  Group,
  Loader,
  Modal,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import {
  collaborationPost,
  errorMessage,
  formatTime,
  Snapshot,
  useCollaborationAction,
  useCollaborationIdentity,
} from "./collaboration-api";
import { MemberPicker } from "./member-picker";
import { SnapshotContent } from "./snapshot-content";

export function ReadingCreateDialog({
  pageId,
  onClose,
}: {
  pageId: string;
  onClose: () => void;
}) {
  const identity = useCollaborationIdentity();
  const [title, setTitle] = useState("");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [checked, setChecked] = useState(false);
  const preview = useQuery({
    queryKey: [
      "document-collaboration",
      identity.workspaceId,
      identity.userId,
      "preview",
      pageId,
    ],
    queryFn: () => collaborationPost<Snapshot>("reading/preview", { pageId }),
    staleTime: 0,
    gcTime: 0,
  });
  const action = useCollaborationAction();
  return (
    <Modal
      opened
      onClose={() => !action.isPending && onClose()}
      title="发起重要文档阅读确认"
      size="900"
      centered
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!preview.data || !checked || !title.trim() || !recipients.length)
            return;
          action.mutate(
            {
              path: "reading/create",
              body: {
                pageId,
                title: title.trim(),
                recipientIds: recipients,
                expectedHash: preview.data.contentHash,
              },
            },
            {
              onSuccess: () => {
                notifications.show({
                  message: "确认批次已发布，内容和接收名单已固定",
                });
                onClose();
              },
              onError: (error) => {
                if ((error as any)?.response?.status === 409) {
                  setChecked(false);
                  void preview.refetch();
                }
              },
            },
          );
        }}
      >
        <Stack>
          <TextInput
            label="批次名称"
            placeholder="例如：实验报告提交要求 · 第1次发布"
            value={title}
            onChange={(e) => setTitle(e.currentTarget.value)}
            maxLength={200}
            required
          />
          <MemberPicker
            multiple
            pageId={pageId}
            value={recipients}
            onChange={setRecipients}
          />
          <Alert color="blue">
            以下预览来自已保存正文。发布后本批次内容和接收名单固定；重要修改需要重新发布一个批次。
          </Alert>
          <Group justify="space-between">
            <Text fw={500}>将要发布的固定内容</Text>
            <Button
              variant="subtle"
              size="xs"
              disabled={preview.isFetching}
              onClick={() => {
                setChecked(false);
                void preview.refetch();
              }}
            >
              刷新已保存内容
            </Button>
          </Group>
          {preview.isFetching ? (
            <Loader size="sm" />
          ) : preview.isError ? (
            <Alert color="red">{errorMessage(preview.error)}</Alert>
          ) : (
            preview.data && (
              <>
                <Text size="sm" c="dimmed">
                  正文保存时间：{formatTime(preview.data.sourceUpdatedAt)}
                </Text>
                <SnapshotContent snapshot={preview.data} />
                <Text size="sm" c="dimmed">
                  确认范围为本批次保存的标题与正文；附件、嵌入页面和外部内容不随批次固定。
                </Text>
                <Checkbox
                  checked={checked}
                  onChange={(e) => setChecked(e.currentTarget.checked)}
                  label="我已核对以上已保存内容，按此版本发布"
                />
              </>
            )
          )}
          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={onClose}
              disabled={action.isPending}
            >
              取消
            </Button>
            <Button
              type="submit"
              loading={action.isPending}
              disabled={
                !checked ||
                preview.isFetching ||
                preview.isError ||
                !title.trim() ||
                !recipients.length
              }
            >
              发布确认批次
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
