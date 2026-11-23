import { Link } from "react-router-dom";
import clsx from "clsx";
import { useComputedColorScheme } from "@mantine/core";
import { IconX } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { ILabel } from "@/features/label/types/label.types.ts";
import { getLabelColor } from "@/features/label/utils/label-colors.ts";
import classes from "@/features/label/label.module.css";

type LabelChipProps = {
  label: Pick<ILabel, "name">;
  onRemove?: () => void;
  asLink?: boolean;
  spaceId?: string;
};

export function LabelChip({
  label,
  onRemove,
  asLink,
  spaceId,
}: LabelChipProps) {
  const { t } = useTranslation();
  const scheme = useComputedColorScheme("light");
  const c = getLabelColor(label.name, scheme);
  const chipStyle = { background: c.bg, color: c.fg };
  const labelUrl = `/labels/${encodeURIComponent(label.name)}`;
  const linkOnly = asLink && !onRemove;

  const nameNode = asLink ? (
    <Link
      to={spaceId ? `${labelUrl}?spaceId=${spaceId}` : labelUrl}
      className={clsx(classes.chipLink, linkOnly && classes.chip)}
      style={linkOnly ? chipStyle : undefined}
      onClick={(e) => e.stopPropagation()}
    >
      <span className={classes.chipName}>{label.name}</span>
    </Link>
  ) : (
    <span className={classes.chipName}>{label.name}</span>
  );

  if (linkOnly) return nameNode;

  return (
    <span className={classes.chip} style={chipStyle}>
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
