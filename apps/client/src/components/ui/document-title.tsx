import React from "react";
import { Helmet } from "react-helmet-async";
import { getAppName } from "@/lib/config.ts";

type DocumentTitleProps = {
  title?: string;
  withAppName?: boolean;
  children?: React.ReactNode;
};

export function DocumentTitle({
  title,
  withAppName = true,
  children,
}: DocumentTitleProps) {
  const appName = getAppName();

  let documentTitle = appName;
  if (title) {
    documentTitle = withAppName ? `${title} - ${appName}` : title;
  }

  return (
    <Helmet>
      <title>{documentTitle}</title>
      {children}
    </Helmet>
  );
}
