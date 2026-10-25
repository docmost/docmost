import { rem } from '@mantine/core';

type Props = {
  size?: number | string;
};

export function AzureDevOpsIcon({ size }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 18 18"
      style={{ width: rem(size), height: rem(size) }}
    >
      <defs>
        <linearGradient id="azure-devops-a" x1="9" x2="9" y1="16.97" y2="1.03" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#0078d4" />
          <stop offset="0.16" stopColor="#1380da" />
          <stop offset="0.53" stopColor="#3c91e5" />
          <stop offset="0.82" stopColor="#559cec" />
          <stop offset="1" stopColor="#5ea0ef" />
        </linearGradient>
      </defs>
      <path
        fill="url(#azure-devops-a)"
        d="M17,4v9.74l-4,3.28-6.2-2.26V17L3.29,12.41l10.23.8V4.44Zm-3.41.49L7.85,1V3.29L2.58,4.84,1,6.87v4.61l2.26,1V6.57Z"
      />
    </svg>
  );
}
