import {
  ActionIcon,
  Tooltip,
  useComputedColorScheme,
  useMantineColorScheme,
} from "@mantine/core";
import { IconMoon, IconSun } from "@tabler/icons-react";
import classes from "./theme-toggle.module.css";
import { useTranslation } from "react-i18next";

export function ThemeToggle() {
  const { setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme();

  const { t } = useTranslation();

  return (
    <Tooltip label={t("Toggle Color Scheme")}>
      <ActionIcon
        variant="default"
        onClick={() => {
          setColorScheme(computedColorScheme === "light" ? "dark" : "light");
        }}
        aria-label={t("Toggle Color Scheme")}
      >
        <IconSun className={classes.light} size={18} stroke={1.5} />
        <IconMoon className={classes.dark} size={18} stroke={1.5} />
      </ActionIcon>
    </Tooltip>
  );
}
