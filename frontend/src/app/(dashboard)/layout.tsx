"use client"

import dynamic from "next/dynamic";
import { UserProvider } from "@/features/user/user-provider";

const Shell = dynamic(() => import("./shell"), {
  ssr: false,
});

export default function DashboardLayout({ children }: {
  children: React.ReactNode
}) {

  return (
    <UserProvider>
      <Shell>
        <div className="w-full flex justify-center z-10 flex-shrink-0">
          <div className={`w-[900px]`}>
            {children}
          </div>
        </div>
      </Shell>
    </UserProvider>
  );
}
