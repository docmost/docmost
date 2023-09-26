'use client';

import dynamic from 'next/dynamic';
import { UserProvider } from '@/features/user/user-provider';

const Shell = dynamic(() => import('./shell'), {
  ssr: false,
});

export default function DashboardLayout({ children }: {
  children: React.ReactNode
}) {

  return (
    <UserProvider>
      <Shell>
        {children}
      </Shell>
    </UserProvider>
  );
}
