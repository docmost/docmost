import { Skeleton } from "@mantine/core";
import classes from "@/features/label/label.module.css";

type LabelPageRowSkeletonProps = {
  titleWidth?: number;
  metaWidth?: number;
};

export function LabelPageRowSkeleton({
  titleWidth = 220,
  metaWidth = 180,
}: LabelPageRowSkeletonProps) {
  return (
    <div className={classes.row} aria-hidden="true">
      <div className={classes.rowMain}>
        <div className={classes.rowIcon}>
          <Skeleton height={18} width={18} radius="sm" />
        </div>
        <div className={classes.rowBody}>
          <Skeleton height={15} width={titleWidth} radius="xs" />
          <div className={classes.rowMeta}>
            <Skeleton height={18} width={18} radius="sm" />
            <Skeleton height={12} width={metaWidth} radius="xs" />
          </div>
        </div>
      </div>
    </div>
  );
}
