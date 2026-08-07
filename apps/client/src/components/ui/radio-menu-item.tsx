import { UnstyledButton } from "@mantine/core";
import { type ComponentPropsWithoutRef, forwardRef } from "react";

// Menu.Item hard-codes role="menuitem"; use as its `component` to restore role="menuitemradio" so aria-checked works.
export const RadioMenuItem = forwardRef<
  HTMLButtonElement,
  ComponentPropsWithoutRef<"button">
>((props, ref) => (
  <UnstyledButton ref={ref} {...props} role="menuitemradio" />
));

RadioMenuItem.displayName = "RadioMenuItem";
