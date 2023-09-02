import React, { forwardRef, ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface ButtonIconProps {
  icon: ReactNode;
  children?: ReactNode;
}

type Props = ButtonIconProps & React.ComponentPropsWithoutRef<typeof Button>;

const ButtonWithIcon = forwardRef<HTMLButtonElement, Props>(
  ({ icon, children, ...rest }, ref) => {
    return (
      <Button ref={ref} {...rest} {...(children ? {} : { size: 'icon' })}>
        <div className={`${children ? 'mr-[8px]' : ''}`}>{icon}</div>
        {children}
      </Button>
    );
  }
);

ButtonWithIcon.displayName = 'ButtonWithIcon';

export default ButtonWithIcon;
