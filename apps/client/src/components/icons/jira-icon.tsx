import { rem } from '@mantine/core';

interface Props {
  size?: number | string;
}

export function JiraIcon({ size }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      style={{ width: rem(size), height: rem(size) }}
    >
      <defs>
        <linearGradient id="jira-a" x1="380.896" x2="279.145" y1="390.609" y2="282.574" gradientTransform="matrix(1 0 0 -1 0 514)" gradientUnits="userSpaceOnUse">
          <stop offset=".176" stopColor="#0052cc" />
          <stop offset="1" stopColor="#2684ff" />
        </linearGradient>
        <linearGradient id="jira-b" x1="265.965" x2="148.117" y1="270.661" y2="152.607" gradientTransform="matrix(1 0 0 -1 0 514)" gradientUnits="userSpaceOnUse">
          <stop offset=".176" stopColor="#0052cc" />
          <stop offset="1" stopColor="#2684ff" />
        </linearGradient>
      </defs>
      <path
        fill="#2684ff"
        d="M490.6 7.4H243.9c0 59.6 49.9 108 111.2 108h45.6v42.2c0 59.6 49.9 108 111.2 108V28.1c.1-11.7-9.2-20.7-21.3-20.7"
      />
      <path
        fill="url(#jira-a)"
        d="M368.7 126.5H121.9c0 59.6 49.9 108 111.2 108h45.6v42.9c0 59.6 49.9 108 111.2 108V147.3c.2-11.1-9.1-20.8-21.2-20.8"
      />
      <path
        fill="url(#jira-b)"
        d="M246.7 246.3H0c0 59.6 49.9 108 111.2 108h45.6v42.2c0 59.6 49.9 108 111.2 108V267.1c.1-11.8-9.9-20.8-21.3-20.8"
      />
    </svg>
  );
}
