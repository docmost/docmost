"use client";

import {
  SettingsNavItem,
  SettingsNavMenuItem, SettingsNavMenuSection,
  settingsNavItems
} from "@/features/settings/nav/settings-nav-items";
import { usePathname } from "next/navigation";
import Link from "next/link";
import React from "react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { ChevronLeftIcon } from "@radix-ui/react-icons";

interface SettingsNavProps {
  menu: SettingsNavItem;
}

function RenderNavItem({ label, icon, target }: SettingsNavMenuItem): React.ReactNode {
  const pathname = usePathname();
  const isActive = pathname === target;

  return (
    <div className="ml-2">
      <Link href={target} className={` ${isActive ? "bg-foreground/10 rounded-md" : ""}
        w-full flex flex-1 justify-start items-center text-sm font-medium px-3 py-2`}>
        <span className="mr-1">{icon}</span>
        <span className="text-ellipsis overflow-hidden">
            {label}
          </span>
      </Link>
    </div>
  );
}

function SettingsNavItems({ menu }: SettingsNavProps): React.ReactNode {
  return (
    <>
      <div>
        <Link
          href="/home"
          className={cn(
            buttonVariants({ variant: "ghost" }),
            "relative")} style={{marginLeft: '-5px', top:'-5px'}}>
          <ChevronLeftIcon className="mr-2 h-4 w-4" /> Back
        </Link>
      </div>

      <div className="p-5 pt-0">
        {menu.map((section: SettingsNavMenuSection, index: number) => (
          <div key={index}>
            <h3 className="flex items-center py-2 text-sm font-semibold text-muted-foreground">
              <span className="mr-1">{section.icon}</span> {section.heading}
            </h3>
            {section.items.map((item: SettingsNavMenuItem, itemIndex: number) => (
              <RenderNavItem key={itemIndex} {...item} />
            ))}
          </div>
        ))}
      </div>
    </>
  );
}

export default function SettingsNav() {
 return <SettingsNavItems menu={settingsNavItems} />
}
