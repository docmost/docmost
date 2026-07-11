import * as React from 'react';
interface MailBodyProps {
    children: React.ReactNode;
}
export declare function MailBody({ children }: MailBodyProps): React.JSX.Element;
export declare function MailHeader(): React.JSX.Element;
interface EmailButtonProps {
    href: string;
    children: React.ReactNode;
}
export declare function EmailButton({ href, children }: EmailButtonProps): React.JSX.Element;
export declare function MailFooter(): React.JSX.Element;
export declare function getGreetingName(name?: string): string;
export {};
