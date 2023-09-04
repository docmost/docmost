import { SidebarSection } from "@/components/sidebar/sidebar-section";
import { navigationMenu, renderMenuItem } from "@/components/sidebar/navigation/navigation-items";
import { ScrollArea } from "@/components/ui/scroll-area";
import NavigationLink from "@/components/sidebar/navigation/navigation-link";
import { IconFileText } from "@tabler/icons-react";

import React from "react";

export default function Navigation() {
  return (
    <div className="pt-8">
      <PrimaryNavigation />
      <SecondaryNavigationArea />
    </div>
  );
}

function PrimaryNavigation() {
  return (
    <SidebarSection className="pb-2 mb-4 select-none border-b">
      {navigationMenu.map(renderMenuItem)}
    </SidebarSection>
  );
}

function SecondaryNavigationArea() {
  return (
    <ScrollArea className="h-[70vh]">
      <div className="space-y-1">
        <NavigationLink
          href="#"
          className="w-full justify-start"
          icon={<IconFileText size={16} />}
        >
          Welcome page
        </NavigationLink>
      </div>
    </ScrollArea>
  );
}
