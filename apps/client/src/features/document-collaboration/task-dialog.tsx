import { useState } from "react";
import { Alert, Button, Group, Modal, Stack, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { DocumentTask, useCollaborationAction } from "./collaboration-api";
import { MemberPicker } from "./member-picker";

function localDate(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
export function TaskDialog({
  pageId,
  task,
  onClose,
}: {
  pageId: string;
  task?: DocumentTask;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(task?.title || "");
  const [assignee, setAssignee] = useState<string[]>(
    task?.assigneeId ? [task.assigneeId] : [],
  );
  const [due, setDue] = useState(localDate(task?.dueAt));
  const action = useCollaborationAction();
  return (
    <Modal
      opened
      onClose={() => !action.isPending && onClose()}
      title={task ? "修改文档待办" : "创建文档待办"}
      size="lg"
      centered
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim() || !assignee.length) return;
          action.mutate(
            {
              path: task ? "tasks/update" : "tasks/create",
              body: {
                ...(task ? { taskId: task.id } : { pageId }),
                title: title.trim(),
                assigneeId: assignee[0],
                dueAt: due ? new Date(due).toISOString() : null,
              },
            },
            {
              onSuccess: () => {
                notifications.show({
                  message: task
                    ? "待办已更新"
                    : "待办已创建，可在“我的待办”查看",
                });
                onClose();
              },
            },
          );
        }}
      >
        <Stack>
          <TextInput
            label="待办标题"
            placeholder="例如：补全系统用例图"
            value={title}
            onChange={(e) => setTitle(e.currentTarget.value)}
            maxLength={200}
            required
          />
          <MemberPicker
            pageId={pageId}
            value={assignee}
            onChange={setAssignee}
            initialMembers={task?.assignee ? [task.assignee] : []}
          />
          <TextInput
            type="datetime-local"
            label="截止时间（可选）"
            description="按当前电脑本地时间填写"
            value={due}
            onChange={(e) => setDue(e.currentTarget.value)}
          />
          <Alert color="blue">
            负责人必须能读取源文档。分配待办不会自动授予文档权限。
          </Alert>
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
              disabled={!title.trim() || !assignee.length}
            >
              {task ? "保存修改" : "创建待办"}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
