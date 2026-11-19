import { IconAsterisk } from "@tabler/icons-react";
import classes from "@/ee/base/styles/form.module.css";

export function FormRequiredMark() {
  return (
    <span className={classes.requiredMark} aria-hidden="true">
      <IconAsterisk size={9} stroke={3} />
    </span>
  );
}
