// MIT - https://github.com/resend/react-email/blob/react-email@6.11.6/packages/react-email/src/components/row/row.tsx
import * as React from 'react';

export type RowProps = Readonly<
  React.ComponentPropsWithoutRef<'table'> & {
    children: React.ReactNode;
  }
>;

export const Row = React.forwardRef<HTMLTableElement, RowProps>(
  ({ children, style, ...props }, ref) => {
    return (
      <table
        align="center"
        width="100%"
        border={0}
        cellPadding="0"
        cellSpacing="0"
        role="presentation"
        {...props}
        ref={ref}
        style={style}
      >
        <tbody style={{ width: '100%' }}>
          <tr style={{ width: '100%' }}>{children}</tr>
        </tbody>
      </table>
    );
  },
);

Row.displayName = 'Row';
