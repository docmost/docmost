import { rem } from "@mantine/core";

interface Props {
  size?: number | string;
}

function IconPlantuml({ size }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="#D2382C"
      viewBox="0 0 24 24"
      style={{ width: rem(size), height: rem(size) }}
    >
      <rect x="3" y="2.5" width="7.5" height="5" rx="1" />
      <rect x="13.5" y="2.5" width="7.5" height="5" rx="1" />
      <rect x="8.25" y="16.5" width="7.5" height="5" rx="1" />
      <path d="M6 7.5h1.5v3.75h9V7.5H18v5.25h-5.25v3.75h-1.5v-3.75H6z" />
    </svg>
  );
}

export default IconPlantuml;
