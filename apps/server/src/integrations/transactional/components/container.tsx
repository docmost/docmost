// MIT - https://github.com/resend/react-email/blob/react-email@6.11.6/packages/react-email/src/components/container/container.tsx
import * as React from 'react';

export type ContainerProps = Readonly<React.ComponentPropsWithoutRef<'table'>>;

export const Container = React.forwardRef<
  HTMLTableElement,
  ContainerProps & { tdClassName?: string }
>(({ children, style = {}, tdClassName, ...props }, ref) => {
  // Split padding styles to improve compatibility with Klaviyo and Outlook,
  // while preserving user-provided style property order without allocating
  // entry arrays on each render.
  const tdStyle: React.CSSProperties = {};
  const tableStyle: React.CSSProperties = {};

  const styleRecord = style as Record<string, unknown>;

  for (const key in styleRecord) {
    if (!Object.prototype.hasOwnProperty.call(styleRecord, key)) {
      continue;
    }

    const value = styleRecord[key];

    if (key.startsWith('padding')) {
      (tdStyle as Record<string, unknown>)[key] = value;
    } else {
      (tableStyle as Record<string, unknown>)[key] = value;
    }
  }

  return (
    <table
      align="center"
      width="100%"
      {...props}
      border={0}
      cellPadding="0"
      cellSpacing="0"
      ref={ref}
      role="presentation"
      style={{ maxWidth: '37.5em', ...tableStyle }}
    >
      <tbody>
        <tr style={{ width: '100%' }}>
          <td className={tdClassName} style={tdStyle}>
            {children}
          </td>
        </tr>
      </tbody>
    </table>
  );
});

Container.displayName = 'Container';
