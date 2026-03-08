import { IconPaperclip } from "@tabler/icons-react";
import { IBaseProperty } from "@/features/base/types/base.types";
import cellClasses from "@/features/base/styles/cells.module.css";

type FileValue = {
  id: string;
  name: string;
  url?: string;
  size?: number;
};

type CellFileProps = {
  value: unknown;
  property: IBaseProperty;
  rowId: string;
  isEditing: boolean;
  onCommit: (value: unknown) => void;
  onCancel: () => void;
};

export function CellFile({
  value,
}: CellFileProps) {
  const files = Array.isArray(value) ? (value as FileValue[]) : [];

  if (files.length === 0) {
    return <span className={cellClasses.emptyValue} />;
  }

  const MAX_VISIBLE = 2;
  const visible = files.slice(0, MAX_VISIBLE);
  const overflow = files.length - MAX_VISIBLE;

  return (
    <div className={cellClasses.fileGroup}>
      {visible.map((file) => (
        <span key={file.id} className={cellClasses.fileBadge}>
          <IconPaperclip size={12} />
          {file.name}
        </span>
      ))}
      {overflow > 0 && (
        <span className={cellClasses.overflowCount}>+{overflow}</span>
      )}
    </div>
  );
}
