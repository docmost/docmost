import { useMemo, useRef, useState, KeyboardEvent } from "react";
import clsx from "clsx";
import { IconPlus } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useComputedColorScheme } from "@mantine/core";
import { ILabel } from "@/features/label/types/label.types.ts";
import { useWorkspaceLabelsQuery } from "@/features/label/queries/label-query.ts";
import { getLabelColor } from "@/features/label/utils/label-colors.ts";
import { normalizeLabelName } from "@/features/label/utils/normalize-label.ts";
import classes from "@/features/label/label.module.css";

type LabelPickerProps = {
  applied: ILabel[];
  enabled: boolean;
  onAdd: (name: string) => void;
  onClose: () => void;
};

const NAME_PATTERN = /^[a-z0-9_-][a-z0-9_~-]*$/;
const MAX_LABEL_NAME_LENGTH = 100;

function isValidLabelName(name: string): boolean {
  return (
    name.length > 0 &&
    name.length <= MAX_LABEL_NAME_LENGTH &&
    NAME_PATTERN.test(name)
  );
}

export function LabelPicker({
  applied,
  enabled,
  onAdd,
  onClose,
}: LabelPickerProps) {
  const { t } = useTranslation();
  const scheme = useComputedColorScheme("light");
  const [query, setQuery] = useState("");
  const [hover, setHover] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const normalized = normalizeLabelName(query);
  const { data } = useWorkspaceLabelsQuery(normalized, enabled);

  const appliedNames = useMemo(
    () => new Set(applied.map((l) => l.name.toLowerCase())),
    [applied],
  );

  const suggestions = useMemo(() => {
    const items = data?.items ?? [];
    return items.filter((l) => !appliedNames.has(l.name.toLowerCase()));
  }, [data, appliedNames]);

  const exact = suggestions.find((l) => l.name === normalized);
  const canCreate =
    !exact && !appliedNames.has(normalized) && isValidLabelName(normalized);

  const total = suggestions.length + (canCreate ? 1 : 0);

  const select = (idx: number) => {
    if (idx < suggestions.length) {
      onAdd(suggestions[idx].name);
    } else if (canCreate) {
      onAdd(normalized);
    }
    setQuery("");
    setHover(0);
    inputRef.current?.focus();
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHover((h) => Math.min(Math.max(total - 1, 0), h + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHover((h) => Math.max(0, h - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (total === 0) return;
      select(hover);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div className={classes.popover}>
      <div className={classes.popoverSearch}>
        <input
          ref={inputRef}
          type="text"
          autoFocus
          maxLength={MAX_LABEL_NAME_LENGTH}
          placeholder={t("Search or create…")}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setHover(0);
          }}
          onKeyDown={onKey}
        />
      </div>
      <div className={classes.popoverList}>
        {total === 0 && (
          <div className={classes.popoverEmpty}>
            {normalized.length === 0
              ? t("No labels yet")
              : appliedNames.has(normalized)
                ? t("Already added")
                : !isValidLabelName(normalized)
                  ? t("Invalid label name")
                  : t("No matches")}
          </div>
        )}
        {suggestions.map((s, i) => {
          const c = getLabelColor(s.name, scheme);
          return (
            <button
              key={s.id}
              type="button"
              className={clsx(
                classes.popoverItem,
                hover === i && classes.popoverItemHover,
              )}
              onMouseEnter={() => setHover(i)}
              onClick={() => select(i)}
            >
              <span
                className={classes.popoverItemDot}
                style={{ background: c.dot }}
              />
              <span className={classes.popoverItemName}>{s.name}</span>
            </button>
          );
        })}
        {canCreate && (
          <button
            type="button"
            className={clsx(
              classes.popoverItem,
              hover === suggestions.length && classes.popoverItemHover,
            )}
            onMouseEnter={() => setHover(suggestions.length)}
            onClick={() => select(suggestions.length)}
          >
            <span className={classes.popoverCreatePlus}>
              <IconPlus size={12} stroke={2} />
            </span>
            <span className={classes.popoverItemName}>
              {t("Create")} <b>"{normalized}"</b>
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
