import { useAppVersion } from "@/features/workspace/queries/workspace-query.ts";
import { isCloud } from "@/lib/config.ts";
import classes from "@/components/settings/settings.module.css";
import { Indicator, Text, Tooltip } from "@mantine/core";
import React from "react";
import semverGt from "semver/functions/gt";

export default function AppVersion() {
  const { data: appVersion } = useAppVersion(!isCloud());

  const hasUpdate =
    appVersion &&
    parseFloat(appVersion.latestVersion) > 0 &&
    semverGt(appVersion.latestVersion, appVersion.currentVersion);

  return (
    <div className={classes.text}>
      <Tooltip
        label={`v${appVersion?.latestVersion} is available`}
        disabled={!hasUpdate}
      >
        <Indicator
          label="New"
          color="gray"
          inline
          size={16}
          position="middle-end"
          style={{ cursor: "pointer" }}
          disabled={!hasUpdate}
        >
          <Text
            size="sm"
            c="dimmed"
            component="a"
            mr={20}
            href="https://github.com/docmost/docmost/releases"
            target="_blank"
          >
            v{APP_VERSION}
          </Text>
        </Indicator>
      </Tooltip>
    </div>
  );
}
