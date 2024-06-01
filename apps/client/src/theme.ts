import { createTheme, MantineColorsTuple } from "@mantine/core";

const blue: MantineColorsTuple = [
  "#e7f3ff",
  "#d0e4ff",
  "#a1c6fa",
  "#6ea6f6",
  "#458bf2",
  "#2b7af1",
  "#0b60d8", //
  "#1b72f2",
  "#0056c1",
  "#004aac",
];

export const theme = createTheme({
  colors: {
    blue,
  },
});
