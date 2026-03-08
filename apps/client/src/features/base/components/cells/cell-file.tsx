import { useState, useRef, useCallback } from "react";
import { Popover, ActionIcon, Text, UnstyledButton } from "@mantine/core";
import {
  IconPaperclip,
  IconUpload,
  IconFile,
  IconX,
} from "@tabler/icons-react";
import { IBaseProperty } from "@/features/base/types/base.types";
import cellClasses from "@/features/base/styles/cells.module.css";
import api from "@/lib/api-client";

export type FileValue = {
  id: string;
  fileName: string;
  mimeType?: string;
  fileSize?: number;
  filePath?: string;
};

type CellFileProps = {
  value: unknown;
  property: IBaseProperty;
  rowId: string;
  isEditing: boolean;
  onCommit: (value: unknown) => void;
  onCancel: () => void;
};

function formatFileSize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function parseFiles(value: unknown): FileValue[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (f): f is FileValue =>
      f && typeof f === "object" && "id" in f && "fileName" in f,
  );
}

export function CellFile({
  value,
  property,
  isEditing,
  onCommit,
  onCancel,
}: CellFileProps) {
  const files = parseFiles(value);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleRemove = useCallback(
    (fileId: string) => {
      const updated = files.filter((f) => f.id !== fileId);
      onCommit(updated.length > 0 ? updated : null);
    },
    [files, onCommit],
  );

  const handleUpload = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      setUploading(true);

      const newFiles: FileValue[] = [...files];

      for (const file of Array.from(fileList)) {
        try {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("baseId", property.baseId);

          const res = await api.post<FileValue>(
            "/bases/files/upload",
            formData,
            {
              headers: { "Content-Type": "multipart/form-data" },
            },
          );

          const attachment = res as unknown as FileValue;
          newFiles.push({
            id: attachment.id,
            fileName: attachment.fileName,
            mimeType: attachment.mimeType,
            fileSize: attachment.fileSize,
            filePath: attachment.filePath,
          });
        } catch (err) {
          console.error("File upload failed:", err);
        }
      }

      setUploading(false);
      onCommit(newFiles.length > 0 ? newFiles : null);
    },
    [files, property.baseId, onCommit],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    },
    [onCancel],
  );

  const MAX_VISIBLE = 2;

  if (isEditing) {
    return (
      <Popover
        opened
        onClose={onCancel}
        position="bottom-start"
        width={280}
        trapFocus
      >
        <Popover.Target>
          <div style={{ width: "100%", height: "100%" }}>
            <FileList files={files} maxVisible={MAX_VISIBLE} />
          </div>
        </Popover.Target>
        <Popover.Dropdown p={8} onKeyDown={handleKeyDown}>
          {files.length === 0 && !uploading && (
            <Text size="xs" c="dimmed" mb={8}>
              No files attached
            </Text>
          )}

          {files.map((file) => (
            <div
              key={file.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "4px 0",
                borderBottom:
                  "1px solid var(--mantine-color-default-border)",
              }}
            >
              <IconFile
                size={14}
                style={{
                  flexShrink: 0,
                  color: "var(--mantine-color-gray-6)",
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <Text size="xs" truncate="end" fw={500}>
                  {file.fileName}
                </Text>
                {file.fileSize != null && (
                  <Text size="xs" c="dimmed">
                    {formatFileSize(file.fileSize)}
                  </Text>
                )}
              </div>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="xs"
                onClick={() => handleRemove(file.id)}
              >
                <IconX size={12} />
              </ActionIcon>
            </div>
          ))}

          <input
            ref={fileInputRef}
            type="file"
            multiple
            style={{ display: "none" }}
            onChange={(e) => {
              handleUpload(e.target.files);
              e.target.value = "";
            }}
          />

          <UnstyledButton
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 0",
              marginTop: 4,
              fontSize: "var(--mantine-font-size-xs)",
              color: uploading
                ? "var(--mantine-color-gray-5)"
                : "var(--mantine-color-blue-6)",
            }}
          >
            <IconUpload size={14} />
            {uploading ? "Uploading..." : "Add file"}
          </UnstyledButton>
        </Popover.Dropdown>
      </Popover>
    );
  }

  if (files.length === 0) {
    return <span className={cellClasses.emptyValue} />;
  }

  return <FileList files={files} maxVisible={MAX_VISIBLE} />;
}

function FileList({
  files,
  maxVisible,
}: {
  files: FileValue[];
  maxVisible: number;
}) {
  const visible = files.slice(0, maxVisible);
  const overflow = files.length - maxVisible;

  return (
    <div className={cellClasses.fileGroup}>
      {visible.map((file) => (
        <span key={file.id} className={cellClasses.fileBadge}>
          <IconPaperclip size={12} />
          {file.fileName}
        </span>
      ))}
      {overflow > 0 && (
        <span className={cellClasses.overflowCount}>+{overflow}</span>
      )}
    </div>
  );
}
