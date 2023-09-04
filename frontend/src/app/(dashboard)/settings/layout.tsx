import { ReactNode } from 'react';

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="w-full flex justify-center z-10 flex-shrink-0">
      <div className={`w-[800px]`}>{children}</div>
    </div>
  );
}
