import { Link } from "react-router-dom";
import { ThemeIcon, Tooltip } from "@mantine/core";
import { IconFileDescription } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { ILabelPageItem } from "@/features/label/types/label.types.ts";
import { LabelChip } from "@/features/label/components/label-chip.tsx";
import { CustomAvatar } from "@/components/ui/custom-avatar.tsx";
import { AvatarIconType } from "@/features/attachments/types/attachment.types.ts";
import { buildPageUrl } from "@/features/page/page.utils";
import { formatLabelListDate } from "@/features/label/utils/format-label-date.ts";
import classes from "@/features/label/label.module.css";

type LabelPageRowProps = {
  page: ILabelPageItem;
  currentLabelName: string;
};

const MAX_VISIBLE_CHIPS = 3;

export function LabelPageRow({ page, currentLabelName }: LabelPageRowProps) {
  const { t } = useTranslation();

  const otherLabels = page.labels.filter((l) => l.name !== currentLabelName);
  const visibleLabels = otherLabels.slice(0, MAX_VISIBLE_CHIPS);
  const hiddenLabels = otherLabels.slice(MAX_VISIBLE_CHIPS);

  return (
    <Link
      to={buildPageUrl(page.space?.slug, page.slugId, page.title ?? undefined)}
      className={classes.row}
    >
      <div className={classes.rowMain}>
        <div className={classes.rowIcon}>
          {page.icon ? (
            <span style={{ fontSize: 16, lineHeight: 1 }}>{page.icon}</span>
          ) : (
            <ThemeIcon variant="transparent" color="gray" size={18}>
              <IconFileDescription size={18} />
            </ThemeIcon>
          )}
        </div>
        <div className={classes.rowBody}>
          <div className={classes.rowTitle}>
            {page.title || t("Untitled")}
          </div>
          <div className={classes.rowMeta}>
            {page.space && (
              <>
                <CustomAvatar
                  name={page.space.name}
                  avatarUrl={page.space.logo ?? undefined}
                  type={AvatarIconType.SPACE_ICON}
                  color="initials"
                  variant="filled"
                  size={18}
                />
                <span>{page.space.name}</span>
                <span className={classes.metaDot} aria-hidden="true">
                  •
                </span>
              </>
            )}
            <span className={classes.rowDate}>
              {t("Updated {{date}}", {
                date: formatLabelListDate(new Date(page.updatedAt)),
              })}
            </span>
          </div>
          {/* {otherLabels.length > 0 && (
            <div className={classes.rowChips}>
              {visibleLabels.map((label) => (
                <LabelChip key={label.id} label={label} asLink />
              ))}
              {hiddenLabels.length > 0 && (
                <Tooltip
                  label={hiddenLabels.map((l) => l.name).join(", ")}
                  withArrow
                  openDelay={200}
                >
                  <span className={classes.chipMore}>
                    +{hiddenLabels.length}
                  </span>
                </Tooltip>
              )}
            </div>
          )} */}
        </div>
      </div>
    </Link>
  );
}
