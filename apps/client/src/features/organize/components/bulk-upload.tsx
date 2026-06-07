import { useRef, useState } from "react";
import {
  Anchor,
  Button,
  Group,
  List,
  Paper,
  Stack,
  Text,
} from "@mantine/core";
import { IconUpload } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import {
  bulkImportFiles,
  createOrganizeTask,
} from "@/features/organize/services/organize-service";
import { OrganizePanel } from "@/features/organize/components/organize-panel";

interface BulkUploadProps {
  spaceId: string;
}

/**
 * Drag-and-drop bulk upload (A3 b-1). Uploads .md/.html files into the space,
 * opens an organize task, and shows the live progress panel. Same endpoints the
 * agent skills use, so the human and agent paths converge.
 */
export function BulkUpload({ spaceId }: BulkUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [organizeTaskId, setOrganizeTaskId] = useState<string | null>(null);
  const [statusUrl, setStatusUrl] = useState<string | null>(null);

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    setFiles((prev) => [...prev, ...Array.from(incoming)]);
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);
    try {
      const fileTask = await bulkImportFiles(spaceId, files);
      const task = await createOrganizeTask({
        spaceId,
        source: "upload",
        title: `Import ${files.length} file(s)`,
        total: files.length,
        fileTaskId: fileTask.id,
      });
      setOrganizeTaskId(task.id);
      setStatusUrl(task.statusUrl);
      setFiles([]);
    } catch (err: any) {
      notifications.show({
        color: "red",
        message:
          err?.response?.data?.message ?? err?.message ?? "Upload failed",
      });
    } finally {
      setUploading(false);
    }
  };

  if (organizeTaskId) {
    return (
      <Stack gap="sm">
        {statusUrl && (
          <Text size="sm" c="dimmed">
            Share this status link:{" "}
            <Anchor href={statusUrl} target="_blank" rel="noreferrer">
              {statusUrl}
            </Anchor>
          </Text>
        )}
        <OrganizePanel organizeTaskId={organizeTaskId} />
        <Button
          variant="subtle"
          onClick={() => {
            setOrganizeTaskId(null);
            setStatusUrl(null);
          }}
        >
          Upload more
        </Button>
      </Stack>
    );
  }

  return (
    <Stack gap="sm">
      <Paper
        withBorder
        p="xl"
        radius="md"
        style={{
          borderStyle: "dashed",
          textAlign: "center",
          cursor: "pointer",
          background: dragging ? "var(--mantine-color-blue-light)" : undefined,
        }}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          addFiles(e.dataTransfer.files);
        }}
      >
        <Group justify="center" gap="xs">
          <IconUpload size={20} />
          <Text size="sm">
            Drag &amp; drop .md / .html files here, or click to select
          </Text>
        </Group>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".md,.markdown,.html,.htm"
          style={{ display: "none" }}
          onChange={(e) => addFiles(e.target.files)}
        />
      </Paper>

      {files.length > 0 && (
        <Paper withBorder p="sm" radius="md">
          <List size="sm">
            {files.map((f, i) => (
              <List.Item key={`${f.name}-${i}`}>{f.name}</List.Item>
            ))}
          </List>
        </Paper>
      )}

      <Group justify="flex-end">
        {files.length > 0 && (
          <Button variant="subtle" onClick={() => setFiles([])}>
            Clear
          </Button>
        )}
        <Button
          leftSection={<IconUpload size={16} />}
          loading={uploading}
          disabled={files.length === 0}
          onClick={handleUpload}
        >
          Upload &amp; organize
        </Button>
      </Group>
    </Stack>
  );
}
