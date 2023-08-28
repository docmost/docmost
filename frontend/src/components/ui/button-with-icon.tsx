import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface ButtonIconProps {
  icon: ReactNode;
  children?: ReactNode;
}

type Props = ButtonIconProps & React.ComponentPropsWithoutRef<typeof Button>;

export default function ButtonWithIcon({ icon, children, ...rest }: Props) {
  return (
    <Button {...rest} {...(children ? {} : { size: 'icon' })}>
      <div className={`${children ? 'mr-[8px]' : ''}`}>{icon}</div>
      {children}
    </Button>
  );
}
