import type { ReactNode } from "react";
import { OneDriveIcon, SharePointIcon } from "@/components/icons";

export type MicrosoftApp = "SharePoint" | "OneDrive";

// Personal OneDrives live on the tenant's -my host, e.g. contoso-my.sharepoint.com
export function microsoftApp(url: string | null | undefined): MicrosoftApp {
  try {
    return new URL(url ?? "").hostname.endsWith("-my.sharepoint.com")
      ? "OneDrive"
      : "SharePoint";
  } catch {
    return "SharePoint";
  }
}

export function microsoftAppIcon(app: MicrosoftApp, size: number): ReactNode {
  return app === "OneDrive" ? (
    <OneDriveIcon size={size} />
  ) : (
    <SharePointIcon size={size} />
  );
}
