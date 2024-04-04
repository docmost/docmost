import { createTheme, MantineColorsTuple } from '@mantine/core';

const blue: MantineColorsTuple = [
  '#e8f3ff',
  '#d0e3ff',
  '#9ec4fc',
  '#69a3fb',
  '#4087fa',
  '#2975fa',
  '#0052cc', //1c6cfb
  '#0f5be1',
  '#0051c9',
  '#0046b1',
];

export const theme = createTheme({
  colors: {
    blue,
  },
});

