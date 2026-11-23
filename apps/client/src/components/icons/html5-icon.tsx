import { rem } from '@mantine/core';

interface Props {
  size?: number | string;
}

// CC BY 3.0 (W3C) - https://www.w3.org/html/logo/index.html
export function Html5Icon({ size }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="74.6 100.6 362.8 411.4"
      style={{ width: rem(size), height: rem(size) }}
    >
      <path fill="#e44d26" d="M107.6 471l-33-370.4h362.8l-33 370.2L255.7 512" />
      <path fill="#f16529" d="M256 480.5V131H404.3L376 447" />
      <path
        fill="#ebebeb"
        d="M142 176.3h114v45.4h-64.2l4.2 46.5h60v45.3H154.4M156.4 336.3H202l3.2 36.3 50.8 13.6v47.4l-93.2-26"
      />
      <path
        fill="#fff"
        d="M369.6 176.3H255.8v45.4h109.6M361.3 268.2H255.8v45.4h56l-5.3 59-50.7 13.6v47.2l93-25.8"
      />
    </svg>
  );
}
