import { useAppVersion } from "@/features/workspace/queries/workspace-query.ts";
import { isCloud } from "@/lib/config.ts";
import classes from "@/components/settings/settings.module.css";
import { Text } from "@mantine/core";
import React from "react";

export default function AppVersion() {
  const { data: appVersion } = useAppVersion(!isCloud());
  const currentVersion = appVersion?.currentVersion;

  return (
    <div className={classes.versionText}>
      <Text size="sm" c="dimmed">
        {currentVersion &&
          (currentVersion.startsWith("v")
            ? currentVersion
            : `v${currentVersion}`)}
      </Text>
    </div>
  );
}
