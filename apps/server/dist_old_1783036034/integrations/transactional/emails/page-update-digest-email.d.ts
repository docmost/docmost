import * as React from 'react';
interface PageUpdate {
    title: string;
    url: string;
    updatedBy: string[];
}
interface Props {
    userName: string;
    pageUpdates: PageUpdate[];
    totalUpdates: number;
}
export declare const PageUpdateDigestEmail: ({ userName, pageUpdates, totalUpdates, }: Props) => React.JSX.Element;
export default PageUpdateDigestEmail;
