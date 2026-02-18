import {
  createTheme,
  CSSVariablesResolver,
  MantineColorsTuple,
} from "@mantine/core";

const blue: MantineColorsTuple = [
  "#e7f3ff",
  "#d0e4ff",
  "#a1c6fa",
  "#6ea6f6",
  "#458bf2",
  "#2b7af1",
  "#0b60d8",
  "#1b72f2",
  "#0056c1",
  "#004aac",
];

const red: MantineColorsTuple = [
  "#ffebeb",
  "#fad7d7",
  "#eeadad",
  "#e3807f",
  "#da5a59",
  "#d54241",
  "#d43535",
  "#bc2727",
  "#a82022",
  "#93151b",
];

export const theme = createTheme({
  colors: {
    blue,
    red,
  },
  primaryColor: "blue",
  defaultRadius: "md",
  fontFamily:
    "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  headings: {
    fontFamily:
      "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    fontWeight: "600",
  },
});

export const mantineCssResolver: CSSVariablesResolver = (theme) => ({
  variables: {
    "--input-error-size": theme.fontSizes.sm,
    "--ui-bg-canvas": "#f7f8fa",
    "--ui-bg-surface": "#ffffff",
    "--ui-bg-subtle": "#f2f4f7",
    "--ui-text-primary": "#111827",
    "--ui-text-secondary": "#5b6473",
    "--ui-text-tertiary": "#8b95a7",
    "--ui-border-default": "#e6e8ec",
    "--ui-border-hover": "#d5dae1",
    "--ui-border-active": "#99a2b3",
    "--ui-accent-primary": "#2563eb",
    "--ui-accent-hover": "#1d4ed8",
    "--ui-shadow-sm": "0 4px 16px rgba(17, 24, 39, 0.06)",
  },
  light: {
    "--mantine-color-body": "var(--ui-bg-canvas)",
    "--mantine-color-default-border": "var(--ui-border-default)",
  },
  dark: {},
});
