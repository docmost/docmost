'use client';

import Sidebar from '@/components/sidebar/sidebar';
import TopBar from '@/components/sidebar/topbar';

export default function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-start min-h-screen">
      <Sidebar />

      <div className="flex flex-col w-full overflow-hidden">
        <TopBar />

        <main
          className="overflow-y-auto overscroll-none w-full p-8"
          style={{ height: 'calc(100vh - 50px)' }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
