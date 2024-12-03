import { rem } from '@mantine/core';

interface Props {
  size?: number | string;
}

export function FigmaIcon({ size }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      style={{ width: rem(size), height: rem(size) }}
    >
      <g fill="none" fillRule="evenodd" transform="translate(4)">
        <circle cx={12} cy={12} r={4} fill="#19bcfe" />
        <path fill="#09cf83" d="M4 24a4 4 0 0 0 4-4v-4H4a4 4 0 1 0 0 8z" />
        <path fill="#a259ff" d="M4 16h4V8H4a4 4 0 1 0 0 8z" />
        <path fill="#f24e1e" d="M4 8h4V0H4a4 4 0 1 0 0 8z" />
        <path fill="#ff7262" d="M12 8H8V0h4a4 4 0 1 1 0 8z" />
      </g>
    </svg>
  );
}
