import { Link } from "react-router-dom";
import { useComputedColorScheme } from "@mantine/core";
import { IconX } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { ILabel } from "@/features/label/types/label.types.ts";
import { getLabelColor } from "@/features/label/utils/label-colors.ts";
import classes from "@/features/label/label.module.css";

type LabelChipProps = {
  label: Pick<ILabel, "id" | "name">;
  onRemove?: () => void;
  asLink?: boolean;
};

export function LabelChip({ label, onRemove, asLink }: LabelChipProps) {
  const { t } = useTranslation();
  const scheme = useComputedColorScheme("light");
  const c = getLabelColor(label.name, scheme);

  const nameNode = asLink ? (
    <Link
      to={`/labels/${encodeURIComponent(label.name)}`}
      className={classes.chipLink}
      onClick={(e) => e.stopPropagation()}
    >
      <span className={classes.chipName}>{label.name}</span>
    </Link>
  ) : (
    <span className={classes.chipName}>{label.name}</span>
  );

  return (
    <span className={classes.chip} style={{ background: c.bg, color: c.fg }}>
      {nameNode}
      {onRemove && (
        <button
          type="button"
          className={classes.chipX}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove();
          }}
          aria-label={t("Remove label {{name}}", { name: label.name })}
        >
          <IconX size={12} stroke={2} />
        </button>
      )}
    </span>
  );
}
