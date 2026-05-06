import React from "react";
import { Burger, BurgerProps } from "@mantine/core";

const SidebarToggle = React.forwardRef<HTMLButtonElement, BurgerProps>(
  ({ opened, ...others }, ref) => {
    return <Burger opened={opened} {...others} ref={ref} />;
  }
);

export default SidebarToggle;
