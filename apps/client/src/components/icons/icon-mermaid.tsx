import { rem } from "@mantine/core";

interface Props {
  size?: number | string;
}

function IconMermaid({ size }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="#FF3670"
      viewBox="0 0 24 24"
      style={{ width: rem(size), height: rem(size) }}
    >
      <path d="M23.99 2.115A12.223 12.223 0 0012 10.149 12.223 12.223 0 00.01 2.115a12.23 12.23 0 005.32 10.604 6.562 6.562 0 012.845 5.423v3.754h7.65v-3.754a6.561 6.561 0 012.844-5.423 12.223 12.223 0 005.32-10.604z"></path>
    </svg>
  );
}

export default IconMermaid;
