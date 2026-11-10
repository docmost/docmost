// MIT - https://github.com/resend/react-email/blob/react-email@6.11.6/packages/react-email/src/components/link/link.tsx
import * as React from 'react';

export type LinkProps = Readonly<React.ComponentPropsWithoutRef<'a'>>;

export const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(
  ({ target = '_blank', style, ...props }, ref) => (
    <a
      {...props}
      ref={ref}
      style={{
        color: '#067df7',
        textDecorationLine: 'none',
        ...style,
      }}
      target={target}
    >
      {props.children}
    </a>
  ),
);

Link.displayName = 'Link';
