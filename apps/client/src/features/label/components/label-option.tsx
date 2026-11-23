import { getLabelColor } from "@/features/label/utils/label-colors";
import classes from "@/features/label/label.module.css";

export function LabelOption({
  name,
  scheme,
}: {
  name: string;
  scheme: "light" | "dark";
}) {
  return (
    <>
      <span
        aria-hidden="true"
        className={classes.popoverItemDot}
        style={{ background: getLabelColor(name, scheme).dot }}
      />
      <span className={classes.popoverItemName}>{name}</span>
    </>
  );
}
