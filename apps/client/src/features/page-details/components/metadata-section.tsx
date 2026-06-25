import { useState, useCallback, useMemo } from "react";
import {
  Divider,
  Group,
  Select,
  Stack,
  Text,
  TextInput,
  NumberInput,
} from "@mantine/core";
import { IconPlus, IconTrash, IconPencil } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import {
  PageMetadata,
  PageMetadataType,
  IPageMetadataEntry,
} from "@/features/page/types/page.types";
import { useUpdatePageMetadata } from "@/features/page-details/queries/metadata-query";
import classes from "./metadata.module.css";

/** 编辑模式下的单条条目，带稳定内部 ID */
interface EditEntry {
  _id: string;
  key: string;
  value: string;
  type: PageMetadataType;
}

type MetadataSectionProps = {
  pageId: string;
  metadata?: PageMetadata;
  canEdit: boolean;
};

let globalIdCounter = 0;
function nextId(): string {
  globalIdCounter++;
  return `m_${globalIdCounter}`;
}

export function MetadataSection({
  pageId,
  metadata,
  canEdit,
}: MetadataSectionProps) {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [editEntries, setEditEntries] = useState<EditEntry[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateMutation = useUpdatePageMetadata(pageId);

  // 查看模式下的条目
  const viewEntries = Object.entries(metadata ?? {});

  // 翻译后的类型选项和标签
  const metadataTypes = useMemo(
    () => [
      { value: "text" as const, label: t("Text") },
      { value: "number" as const, label: t("Number") },
      { value: "boolean" as const, label: t("Boolean") },
      { value: "date" as const, label: t("Date") },
    ],
    [t],
  );

  const typeLabels = useMemo<Record<PageMetadataType, string>>(
    () => ({
      text: t("Text"),
      number: t("Number"),
      boolean: t("Boolean"),
      date: t("Date"),
    }),
    [t],
  );

  // 无数据且不可编辑时隐藏
  if (!canEdit && viewEntries.length === 0) {
    return null;
  }

  const startEditing = () => {
    const m = metadata ?? {};
    setEditEntries(
      Object.entries(m).map(([key, entry]) => ({
        _id: nextId(),
        key,
        value: entry.value,
        type: entry.type,
      })),
    );
    setErrors({});
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditEntries([]);
    setErrors({});
  };

  const validateEntries = (): boolean => {
    const newErrors: Record<string, string> = {};
    const seenKeys = new Set<string>();

    for (const entry of editEntries) {
      const trimmedKey = entry.key.trim();
      if (trimmedKey.length === 0) {
        newErrors[entry._id] = t("Metadata key cannot be empty");
        continue;
      }
      if (seenKeys.has(trimmedKey)) {
        newErrors[entry._id] = t(
          'Metadata key "{{key}}" is duplicated',
          { key: trimmedKey },
        );
        continue;
      }
      seenKeys.add(trimmedKey);
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const saveEditing = () => {
    if (!validateEntries()) return;

    const record: PageMetadata = {};
    for (const entry of editEntries) {
      const key = entry.key.trim();
      record[key] = { value: entry.value, type: entry.type };
    }

    updateMutation.mutate(record, {
      onSuccess: () => {
        setIsEditing(false);
        setEditEntries([]);
        setErrors({});
      },
    });
  };

  const addEntry = () => {
    setEditEntries((prev) => [
      ...prev,
      { _id: nextId(), key: "", value: "", type: "text" },
    ]);
  };

  const updateEntry = useCallback(
    (_id: string, patch: Partial<Omit<EditEntry, "_id">>) => {
      setEditEntries((prev) =>
        prev.map((e) => (e._id === _id ? { ...e, ...patch } : e)),
      );
      setErrors((prev) => {
        if (prev[_id]) {
          const next = { ...prev };
          delete next[_id];
          return next;
        }
        return prev;
      });
    },
    [],
  );

  const deleteEntry = useCallback((_id: string) => {
    setEditEntries((prev) => prev.filter((e) => e._id !== _id));
    setErrors((prev) => {
      if (prev[_id]) {
        const next = { ...prev };
        delete next[_id];
        return next;
      }
      return prev;
    });
  }, []);

  return (
    <>
      <Divider />
      <Stack gap="xs">
        <Group justify="space-between" wrap="nowrap">
          <Text size="xs" fw={500} c="dimmed">
            {t("Metadata")}
          </Text>
          {canEdit && !isEditing && (
            <button
              type="button"
              className={classes.editBtn}
              onClick={startEditing}
            >
              <IconPencil size={12} stroke={2} />
            </button>
          )}
        </Group>

        {/* 查看模式 */}
        {!isEditing && viewEntries.length === 0 && (
          <Text size="sm" c="dimmed">
            {t("No metadata")}
          </Text>
        )}

        <div className={classes.metadataWrap}>
          {!isEditing &&
            viewEntries.map(([key, entry]) => (
              <div key={key} className={classes.entryRow}>
                <Text size="sm" fw={500} className={classes.entryKey}>
                  {key}
                </Text>
                <Text size="sm" c="dimmed" className={classes.entryValue}>
                  {formatValue(entry, t)}
                </Text>
                <span className={classes.typeTag}>
                  {typeLabels[entry.type]}
                </span>
              </div>
            ))}

          {/* 编辑模式 */}
          {isEditing &&
            editEntries.map((entry) => (
              <EditEntryRow
                key={entry._id}
                entry={entry}
                error={errors[entry._id]}
                metadataTypes={metadataTypes}
                onUpdate={(patch) => updateEntry(entry._id, patch)}
                onDelete={() => deleteEntry(entry._id)}
                getPlaceholder={(type) =>
                  type === "date" ? "YYYY-MM-DD" : t("Value")
                }
                t={t}
              />
            ))}

          {/* 编辑模式操作按钮 */}
          {isEditing && (
            <div className={classes.editActions}>
              <button
                type="button"
                className={classes.addBtn}
                onClick={addEntry}
              >
                <IconPlus size={12} stroke={2} />
                <span>{t("Add")}</span>
              </button>
              <Group gap="xs">
                <button
                  type="button"
                  className={classes.cancelBtn}
                  onClick={cancelEditing}
                >
                  {t("Cancel")}
                </button>
                <button
                  type="button"
                  className={classes.saveBtn}
                  onClick={saveEditing}
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending ? t("Saving...") : t("Save")}
                </button>
              </Group>
            </div>
          )}
        </div>
      </Stack>
    </>
  );
}

/** 单条编辑行 */
function EditEntryRow({
  entry,
  error,
  metadataTypes,
  onUpdate,
  onDelete,
  getPlaceholder,
  t,
}: {
  entry: EditEntry;
  error?: string;
  metadataTypes: { value: PageMetadataType; label: string }[];
  onUpdate: (patch: Partial<Omit<EditEntry, "_id">>) => void;
  onDelete: () => void;
  getPlaceholder: (type: PageMetadataType) => string;
  t: (key: string) => string;
}) {
  const handleTypeChange = (value: string | null) => {
    if (!value) return;
    const newType = value as PageMetadataType;
    const newValue =
      entry.type === newType
        ? entry.value
        : resetValueForType(entry.value, entry.type, newType);
    onUpdate({ type: newType, value: newValue });
  };

  return (
    <div className={classes.editEntryCard}>
      <div className={classes.editEntryTop}>
        <TextInput
          size="xs"
          placeholder={t("Metadata key")}
          value={entry.key}
          onChange={(e) => onUpdate({ key: e.target.value })}
          className={classes.editKeyInput}
          variant="filled"
          error={!!error}
        />
        <Select
          size="xs"
          data={metadataTypes}
          value={entry.type}
          onChange={handleTypeChange}
          className={classes.editTypeSelect}
          variant="filled"
          allowDeselect={false}
        />
      </div>
      <div className={classes.editEntryBottom}>
        <ValueInput
          type={entry.type}
          value={entry.value}
          onChange={(value) => onUpdate({ value })}
          placeholder={getPlaceholder(entry.type)}
          t={t}
        />
        <button
          type="button"
          className={classes.deleteBtn}
          onClick={onDelete}
        >
          <IconTrash size={14} stroke={2} />
        </button>
      </div>
    </div>
  );
}

/** 根据 metadata 类型切换值输入控件 */
function ValueInput({
  type,
  value,
  onChange,
  placeholder,
  t,
}: {
  type: PageMetadataType;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  t: (key: string) => string;
}) {
  switch (type) {
    case "text":
      return (
        <TextInput
          size="xs"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={classes.editValueInput}
          variant="filled"
        />
      );
    case "number":
      return (
        <NumberInput
          size="xs"
          placeholder={placeholder}
          value={value === "" ? "" : Number(value)}
          onChange={(val) => onChange(val === "" ? "" : String(val))}
          className={classes.editValueInput}
          variant="filled"
          decimalScale={10}
        />
      );
    case "boolean":
      return (
        <label className={classes.editBoolWrap}>
          <input
            type="checkbox"
            checked={value === "true"}
            onChange={(e) =>
              onChange(e.target.checked ? "true" : "false")
            }
            className={classes.editBoolCheckbox}
          />
          <span className={classes.editBoolLabel}>
            {value === "true" ? t("Yes") : t("No")}
          </span>
        </label>
      );
    case "date":
      return (
        <input
          type="text"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={classes.editDateInput}
        />
      );
    default:
      return (
        <TextInput
          size="xs"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={classes.editValueInput}
          variant="filled"
        />
      );
  }
}

/** 查看模式下格式化显示值 */
function formatValue(
  entry: IPageMetadataEntry,
  t: (key: string) => string,
): string {
  switch (entry.type) {
    case "boolean":
      return entry.value === "true" ? "✓" : "✗";
    case "number":
      return entry.value;
    case "date":
      return entry.value;
    case "text":
    default:
      return entry.value.length > 50
        ? entry.value.slice(0, 50) + "..."
        : entry.value;
  }
}

/** 切换类型时重置不兼容的值 */
function resetValueForType(
  value: string,
  oldType: PageMetadataType,
  newType: PageMetadataType,
): string {
  if (oldType === newType) return value;
  if (value === "") return "";
  switch (newType) {
    case "boolean":
      return "false";
    case "number":
      return isNaN(Number(value)) ? "" : value;
    default:
      return value;
  }
}
