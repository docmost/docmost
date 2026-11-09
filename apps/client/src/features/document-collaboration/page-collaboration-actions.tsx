import { useState } from "react";
import { Button, Menu } from "@mantine/core";
import {
  IconChecklist,
  IconClipboardCheck,
  IconChevronDown,
} from "@tabler/icons-react";
import { Link } from "react-router-dom";
import { TaskDialog } from "./task-dialog";
import { ReadingCreateDialog } from "./reading-create-dialog";
import { useCollaborationIdentity } from "./collaboration-api";

export function PageCollaborationActions({
  pageId,
  canEdit,
}: {
  pageId: string;
  canEdit: boolean;
}) {
  const [dialog, setDialog] = useState<"task" | "reading" | null>(null);
  const { workspaceId, userId } = useCollaborationIdentity();
  if (!pageId) return null;
  return (
    <>
      <Menu position="bottom-end" width={230}>
        <Menu.Target>
          <Button
            variant="subtle"
            size="compact-sm"
            rightSection={<IconChevronDown size={14} />}
          >
            协作事项
          </Button>
        </Menu.Target>
        <Menu.Dropdown>
          {canEdit && (
            <>
              <Menu.Item
                leftSection={<IconChecklist size={16} />}
                onClick={() => setDialog("task")}
              >
                创建文档待办
              </Menu.Item>
              <Menu.Item
                leftSection={<IconClipboardCheck size={16} />}
                onClick={() => setDialog("reading")}
              >
                发起阅读确认
              </Menu.Item>
              <Menu.Divider />
            </>
          )}
          <Menu.Item
            component={Link}
            to={`/collaboration/tasks?pageId=${pageId}`}
          >
            查看本文待办
          </Menu.Item>
          <Menu.Item
            component={Link}
            to={`/collaboration/reading?pageId=${pageId}`}
          >
            查看本文确认批次
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
      {dialog === "task" && (
        <TaskDialog
          key={`${workspaceId}:${userId}:${pageId}`}
          pageId={pageId}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "reading" && (
        <ReadingCreateDialog
          key={`${workspaceId}:${userId}:${pageId}`}
          pageId={pageId}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}
