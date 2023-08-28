import React, { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SidebarSectionProps {
  className?: string;
  children: ReactNode
}

export function SidebarSection({className, children}: SidebarSectionProps) {
  return (
    <div className={cn('flex-shrink-0 flex-grow-0 pb-0.5', className)}>
      {children}
    </div>
  )
}
