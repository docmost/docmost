import classes from "@/ee/base/styles/grid.module.css";

type GridGhostRowsProps = {
  /** how many placeholder rows to render */
  count: number;
  /** number of visible leaf columns (incl. the row-number column) */
  columnCount: number;
  /** create the first real row (clicking any ghost cell); omit when read-only */
  onCreate?: () => void;
};

// Empty-state ghost rows shown when no data rows exist and no filter is active.
// Clicking any ghost row creates the first real row; cells align via subgrid.
export function GridGhostRows({ count, columnCount, onCreate }: GridGhostRowsProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, rowIdx) => (
        <div
          key={rowIdx}
          className={`${classes.row} ${classes.ghostRow}`}
          role={onCreate ? "button" : undefined}
          aria-label={onCreate ? "Create first row" : undefined}
          onClick={onCreate}
        >
          {Array.from({ length: columnCount }).map((_, colIdx) => (
            <div key={colIdx} className={classes.cell} aria-hidden="true" />
          ))}
        </div>
      ))}
    </>
  );
}
