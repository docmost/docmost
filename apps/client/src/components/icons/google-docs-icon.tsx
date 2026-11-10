import { rem } from '@mantine/core';

interface Props {
  size?: number | string;
}

export function GoogleDocsIcon({ size }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 47 65"
      style={{ width: rem(size), height: rem(size) }}
    >
      <path
        fill="#4285F4"
        d="M29.375 0H4.406C1.983 0 0 1.994 0 4.432v56.136C0 63.006 1.983 65 4.406 65h38.188C45.017 65 47 63.006 47 60.568v-42.84L36.719 10.34z"
      />
      <path
        fill="#A1C2FA"
        d="M29.375 0v13.295c0 2.449 1.972 4.432 4.406 4.432H47z"
      />
      <path
        fill="#F1F1F1"
        d="M11.75 47.273h23.5v-2.955h-23.5zm0 5.909h17.625v-2.955H11.75zm0-20.682v2.955h23.5V32.5zm0 8.864h23.5v-2.955h-23.5z"
      />
    </svg>
  );
}
