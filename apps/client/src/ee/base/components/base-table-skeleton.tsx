import { Skeleton } from "@mantine/core";
import gridClasses from "@/ee/base/styles/grid.module.css";
import classes from "@/ee/base/styles/base-table-skeleton.module.css";

const ROW_NUMBER_WIDTH = 64;
const COLUMN_WIDTH = 180;
const DEFAULT_COLUMN_COUNT = 6;
const DEFAULT_ROW_COUNT = 10;

// Deterministic widths prevent flicker between renders.
const CELL_WIDTH_RATIOS = [0.78, 0.62, 0.84, 0.55, 0.71, 0.66];
const HEADER_WIDTH_RATIOS = [0.42, 0.58, 0.5, 0.64, 0.46, 0.54];

type BaseTableSkeletonProps = {
  // Match the eventual content shape to avoid a jarring size jump on swap.
  rows?: number;
  columns?: number;
};

export function BaseTableSkeleton({
  rows = DEFAULT_ROW_COUNT,
  columns = DEFAULT_COLUMN_COUNT,
}: BaseTableSkeletonProps = {}) {
  const gridTemplateColumns = [
    `${ROW_NUMBER_WIDTH}px`,
    ...Array.from({ length: columns }, () => `${COLUMN_WIDTH}px`),
  ].join(" ");

  return (
    <div className={classes.root}>
      <div className={classes.toolbar}>
        <div className={classes.toolbarTabs}>
          <Skeleton height={22} width={44} radius="sm" />
          <Skeleton height={22} width={64} radius="sm" />
          <Skeleton height={22} width={48} radius="sm" />
        </div>
        <div className={classes.toolbarActions}>
          <Skeleton height={22} width={22} circle />
          <Skeleton height={22} width={22} circle />
          <Skeleton height={22} width={22} circle />
          <Skeleton height={22} width={22} circle />
        </div>
      </div>

      <div className={classes.gridWrapper}>
        <div className={classes.grid} style={{ gridTemplateColumns }}>
          <div className={gridClasses.headerCell}>
            <div className={classes.headerCellInner}>
              <Skeleton height={14} width={14} circle />
            </div>
          </div>
          {Array.from({ length: columns }).map((_, colIndex) => (
            <div key={`h-${colIndex}`} className={gridClasses.headerCell}>
              <div className={classes.headerCellInner}>
                <Skeleton height={14} width={14} circle />
                <Skeleton
                  height={10}
                  width={`${HEADER_WIDTH_RATIOS[colIndex % HEADER_WIDTH_RATIOS.length] * 100}%`}
                  radius="sm"
                />
              </div>
            </div>
          ))}

          {Array.from({ length: rows }).map((_, rowIndex) => (
            <div key={`row-${rowIndex}`} style={{ display: "contents" }}>
              <div className={gridClasses.cell}>
                <div className={classes.cellInner}>
                  <Skeleton height={10} width={18} radius="sm" />
                </div>
              </div>
              {Array.from({ length: columns }).map((_, colIndex) => (
                <div
                  key={`cell-${rowIndex}-${colIndex}`}
                  className={gridClasses.cell}
                >
                  <div className={classes.cellInner}>
                    <Skeleton
                      height={10}
                      width={`${CELL_WIDTH_RATIOS[(rowIndex + colIndex) % CELL_WIDTH_RATIOS.length] * 100}%`}
                      radius="sm"
                    />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
