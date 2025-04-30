import { useAppVersion } from "@/features/workspace/queries/workspace-query.ts";
import { isCloud } from "@/lib/config.ts";
import classes from "@/components/settings/settings.module.css";
import { Indicator, Text, Tooltip } from "@mantine/core";
import React from "react";
import semverGt from "semver/functions/gt";
import { useTranslation } from "react-i18next";

export default function AppVersion() {
  const { t } = useTranslation();
  const { data: appVersion } = useAppVersion(!isCloud());
  let hasUpdate = false;
  try {
    hasUpdate =
      appVersion &&
      parseFloat(appVersion.latestVersion) > 0 &&
      semverGt(appVersion.latestVersion, appVersion.currentVersion);
  } catch (err) {
    console.error(err);
  }

  return (
    <div className={classes.text}>
      <Tooltip
        label={t("{{latestVersion}} is available", {
          latestVersion: `v${appVersion?.latestVersion}`,
        })}
        disabled={!hasUpdate}
      >
        <Indicator
          label={t("New update")}
          color="gray"
          inline
          size={16}
          position="middle-end"
          style={{ cursor: "pointer" }}
          disabled={!hasUpdate}
          onClick={() => {
            window.open(
              "https://github.com/docmost/docmost/releases",
              "_blank",
            );
          }}
        >
          <Text
            size="sm"
            c="dimmed"
            component="a"
            mr={45}
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
