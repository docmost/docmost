import { rem } from '@mantine/core';

interface Props {
  size?: number | string;
}

export function FramerIcon({ size }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      style={{ width: rem(size), height: rem(size) }}
    >
      <path d="M4 0h16v8h-8zm0 8h8l8 8H4zm0 8h8v8z" />
    </svg>
  );
}
