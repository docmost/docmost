import { IBaseProperty } from "@/features/base/types/base.types";
import cellClasses from "@/features/base/styles/cells.module.css";

type CellPersonProps = {
  value: unknown;
  property: IBaseProperty;
  rowId: string;
  isEditing: boolean;
  onCommit: (value: unknown) => void;
  onCancel: () => void;
};

function getInitials(id: string): string {
  return id.substring(0, 2).toUpperCase();
}

export function CellPerson({
  value,
}: CellPersonProps) {
  const personIds = Array.isArray(value)
    ? (value as string[])
    : typeof value === "string"
      ? [value]
      : [];

  if (personIds.length === 0) {
    return <span className={cellClasses.emptyValue} />;
  }

  const MAX_VISIBLE = 4;
  const visible = personIds.slice(0, MAX_VISIBLE);
  const overflow = personIds.length - MAX_VISIBLE;

  return (
    <div className={cellClasses.personGroup}>
      {visible.map((id) => (
        <div key={id} className={cellClasses.personAvatar}>
          {getInitials(id)}
        </div>
      ))}
      {overflow > 0 && (
        <span className={cellClasses.overflowCount}>+{overflow}</span>
      )}
    </div>
  );
}
