import { rem } from '@mantine/core';

interface Props {
    size?: number | string;
}

export function GoogleDocsIcon({ size }: Props) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 48 48"
            style={{ width: rem(size), height: rem(size) }}
        >
            <path fill="#2196f3" d="M37,45H11c-1.657,0-3-1.343-3-3V6c0-1.657,1.343-3,3-3h19l10,10v29C40,43.657,38.657,45,37,45z" />
            <path fill="#bbdefb" d="M40 13L30 13 30 3z" />
            <path fill="#1976d2" d="M30 13L40 23 40 13z" />
            <path
                fill="#e3f2fd"
                d="M31,23H17h-2v2v2h18v-2v-2H31z M31,27H17h-2v2v2h18v-2v-2H31z M31,31H17h-2v2v2h18v-2v-2H31z M31,35h-8v-2h8V35z"
            />
        </svg>
    );
}
