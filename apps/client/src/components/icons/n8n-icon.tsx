import { rem } from '@mantine/core';

interface Props {
  size?: number | string;
}

export function N8nIcon({ size }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="#1A1A1A"
      style={{ width: rem(size), height: rem(size) }}
    >
      <path
        d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm6.364 17.364L12 19.727l-6.364-2.363V6.636L12 4.273l6.364 2.363v10.728z"
      />
    </svg>
  );
}
