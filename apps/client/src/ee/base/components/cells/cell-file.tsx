import { useState, useRef, useCallback } from "react";
import { Popover, ActionIcon, Text, UnstyledButton } from "@mantine/core";
import {
  IconPaperclip,
  IconUpload,
  IconFile,
  IconX,
} from "@tabler/icons-react";
import { IBaseProperty } from "@/ee/base/types/base.types";
import cellClasses from "@/ee/base/styles/cells.module.css";
import { uploadFile } from "@/features/page/services/page-service";
import { getFileUrl } from "@/lib/config";

export type FileValue = {
  id: string;
  fileName: string;
  mimeType?: string;
  fileSize?: number;
  url?: string;
};

function buildFileUrl(file: Pick<FileValue, "id" | "fileName" | "url">): string {
  return file.url ?? `/api/files/${file.id}/${encodeURIComponent(file.fileName)}`;
}

type CellFileProps = {
  value: unknown;
  property: IBaseProperty;
  rowId: string;
  isEditing: boolean;
  readOnly?: boolean;
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
  readOnly,
  onCommit,
  onCancel,
}: CellFileProps) {
  const files = parseFiles(value);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleRemove = useCallback(
    (fileId: string) => {
      if (readOnly) return;
      const updated = files.filter((f) => f.id !== fileId);
      onCommit(updated.length > 0 ? updated : null);
    },
    [readOnly, files, onCommit],
  );

  const handleUpload = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      setUploading(true);

      const newFiles: FileValue[] = [...files];

      // Reuse the page-attachment upload pipeline: the base's pageId is passed
      // to the standard /files/upload endpoint, which enforces the same edit
      // access check as any other page attachment.
      for (const file of Array.from(fileList)) {
        try {
          const attachment = await uploadFile(file, property.pageId);
          newFiles.push({
            id: attachment.id,
            fileName: attachment.fileName,
            mimeType: attachment.mimeType,
            fileSize: attachment.fileSize,
            url: `/api/files/${attachment.id}/${encodeURIComponent(attachment.fileName)}`,
          });
        } catch (err) {
          console.error("File upload failed:", err);
        }
      }

      setUploading(false);
      onCommit(newFiles.length > 0 ? newFiles : null);
    },
    [files, property.pageId, onCommit],
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
        onChange={(o) => {
          if (!o) onCancel();
        }}
        onClose={onCancel}
        position="bottom-start"
        width={280}
        trapFocus
        closeOnClickOutside
        closeOnEscape
        hideDetached={false}
      >
        <Popover.Target>
          <div className={cellClasses.popoverTarget}>
            <FileList files={files} maxVisible={MAX_VISIBLE} />
          </div>
        </Popover.Target>
        <Popover.Dropdown p={8} onKeyDown={handleKeyDown}>
          {!readOnly && files.length === 0 && !uploading && (
            <Text size="xs" c="dimmed" mb={8}>
              No files attached
            </Text>
          )}

          {files.map((file) => (
            <div key={file.id} className={cellClasses.fileItemRow}>
              <IconFile size={14} className={cellClasses.fileItemIcon} />
              <a
                href={getFileUrl(buildFileUrl(file))}
                target="_blank"
                rel="noreferrer"
                className={cellClasses.fileItemLink}
              >
                <Text size="xs" truncate="end" fw={500}>
                  {file.fileName}
                </Text>
                {file.fileSize != null && (
                  <Text size="xs" c="dimmed">
                    {formatFileSize(file.fileSize)}
                  </Text>
                )}
              </a>
              {!readOnly && (
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  size="xs"
                  onClick={() => handleRemove(file.id)}
                >
                  <IconX size={12} />
                </ActionIcon>
              )}
            </div>
          ))}

          {!readOnly && (
            <>
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
                className={cellClasses.fileUploadBtn}
                style={{
                  color: uploading
                    ? "var(--mantine-color-gray-5)"
                    : "var(--mantine-color-blue-6)",
                }}
              >
                <IconUpload size={14} />
                {uploading ? "Uploading..." : "Add file"}
              </UnstyledButton>
            </>
          )}
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
