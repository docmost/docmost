import { UnstyledButton } from "@mantine/core";
import { type ComponentPropsWithoutRef, forwardRef } from "react";

// Menu.Item hard-codes role="menuitem"; use as its `component` to restore role="menuitemcheckbox" so aria-checked works.
export const CheckboxMenuItem = forwardRef<
  HTMLButtonElement,
  ComponentPropsWithoutRef<"button">
>((props, ref) => (
  <UnstyledButton ref={ref} {...props} role="menuitemcheckbox" />
));

CheckboxMenuItem.displayName = "CheckboxMenuItem";
