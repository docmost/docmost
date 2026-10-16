import { rem } from '@mantine/core';

interface Props {
  size?: number | string;
}

export function MiroIcon({ size }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="3 2 395 395"
      style={{ width: rem(size), height: rem(size) }}
    >
      <path
        fill="#FFDD33"
        d="M3 100.754C3 46.2604 47.2435 2 101.754 2H299.246C353.756 2 398 46.2435 398 100.754V298.246C398 352.756 353.756 397 299.246 397H101.754C47.2435 397 3 352.756 3 298.246V100.754Z"
      />
      <path
        fill="#1C1C1E"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M265.573 77.3491H229.74L259.629 129.85L193.906 77.3491H158.072L190.934 141.468L122.238 77.3491H86.4041L122.238 159.031L86.4041 322.377H122.238L190.934 147.396L158.072 322.377H193.906L259.629 135.693L229.74 322.377H265.573L331.297 118.232L265.573 77.4335V77.3491Z"
      />
    </svg>
  );
}
