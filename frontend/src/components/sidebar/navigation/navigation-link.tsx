import { ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface NavigationLinkProps {
  children: ReactNode,
  href: string;
  icon?: ReactNode;
  variant?: "default" | "ghost" | "outline";
  className?: string;
}

export default function NavigationLink({ children, href, icon, variant = "ghost", className }: NavigationLinkProps) {
  return (
    <Link href={href} className={cn(buttonVariants({ variant: variant }), className)}>
      {icon && <span className="mr-[8px]">
        {icon}
      </span>}
      <span className="text-ellipsis overflow-hidden">
        {children}
      </span>
    </Link>
  );
}
