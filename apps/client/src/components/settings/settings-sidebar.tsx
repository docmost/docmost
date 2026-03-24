import React, { useEffect, useState } from "react";
import { Group, Text, ScrollArea, ActionIcon, Tooltip } from "@mantine/core";
import {
  IconUser,
  IconSettings,
  IconUsers,
  IconArrowLeft,
  IconUsersGroup,
  IconSpaces,
  IconBrush,
  IconCoin,
  IconLock,
  IconKey,
  IconWorld,
  IconSparkles,
  IconHistory,
} from "@tabler/icons-react";
import { Link, useLocation } from "react-router-dom";
import classes from "./settings.module.css";
import { useTranslation } from "react-i18next";
import { isCloud } from "@/lib/config.ts";
import useUserRole from "@/hooks/use-user-role.tsx";
import { useAtom } from "jotai";
import { entitlementAtom } from "@/ee/entitlement/entitlement-atom";
import { Feature } from "@/ee/features";
import { useUpgradeLabel } from "@/ee/hooks/use-upgrade-label";
import {
  prefetchApiKeyManagement,
  prefetchApiKeys,
  prefetchBilling,
  prefetchGroups,
  prefetchLicense,
  prefetchShares,
  prefetchSpaces,
  prefetchSsoProviders,
  prefetchWorkspaceMembers,
  prefetchAuditLogs,
} from "@/components/settings/settings-queries.tsx";
import AppVersion from "@/components/settings/app-version.tsx";
import { mobileSidebarAtom } from "@/components/layouts/global/hooks/atoms/sidebar-atom.ts";
import { useToggleSidebar } from "@/components/layouts/global/hooks/hooks/use-toggle-sidebar.ts";
import { useSettingsNavigation } from "@/hooks/use-settings-navigation";

type DataItem = {
  label: string;
  icon: React.ElementType;
  path: string;
  feature?: string;
  role?: "admin" | "owner";
  env?: "cloud" | "selfhosted";
};

type DataGroup = {
  heading: string;
  items: DataItem[];
};

const groupedData: DataGroup[] = [
  {
    heading: "Account",
    items: [
      { label: "Profile", icon: IconUser, path: "/settings/account/profile" },
      {
        label: "Preferences",
        icon: IconBrush,
        path: "/settings/account/preferences",
      },
      {
        label: "API keys",
        icon: IconKey,
        path: "/settings/account/api-keys",
        feature: Feature.API_KEYS,
      },
    ],
  },
  {
    heading: "Workspace",
    items: [
      { label: "General", icon: IconSettings, path: "/settings/workspace" },
      { label: "Members", icon: IconUsers, path: "/settings/members" },
      {
        label: "Billing",
        icon: IconCoin,
        path: "/settings/billing",
        role: "admin",
        env: "cloud",
      },
      {
        label: "Security & SSO",
        icon: IconLock,
        path: "/settings/security",
        feature: Feature.SECURITY_SETTINGS,
        role: "admin",
      },
      { label: "Groups", icon: IconUsersGroup, path: "/settings/groups" },
      { label: "Spaces", icon: IconSpaces, path: "/settings/spaces" },
      { label: "Public sharing", icon: IconWorld, path: "/settings/sharing" },
      {
        label: "API management",
        icon: IconKey,
        path: "/settings/api-keys",
        feature: Feature.API_KEYS,
        role: "admin",
      },
      {
        label: "AI settings",
        icon: IconSparkles,
        path: "/settings/ai",
        role: "admin",
      },
      {
        label: "Audit log",
        icon: IconHistory,
        path: "/settings/audit",
        feature: Feature.AUDIT_LOGS,
        role: "owner",
        env: "selfhosted",
      },
    ],
  },
  {
    heading: "System",
    items: [
      {
        label: "License & Edition",
        icon: IconKey,
        path: "/settings/license",
      },
    ],
  },
];

export default function SettingsSidebar() {
  const { t } = useTranslation();
  const location = useLocation();
  const [active, setActive] = useState(location.pathname);
  const { goBack } = useSettingsNavigation();
  const { isAdmin, isOwner } = useUserRole();
  const [entitlements] = useAtom(entitlementAtom);
  const upgradeLabel = useUpgradeLabel();
  const [mobileSidebarOpened] = useAtom(mobileSidebarAtom);
  const toggleMobileSidebar = useToggleSidebar(mobileSidebarAtom);

  useEffect(() => {
    setActive(location.pathname);
  }, [location.pathname]);

  const hasFeature = (f: string) =>
    entitlements?.features?.includes(f) ?? false;

  const canShowItem = (item: DataItem) => {
    if (item.env === "cloud" && !isCloud()) return false;
    if (item.env === "selfhosted" && isCloud()) return false;
    if (item.role === "admin" && !isAdmin) return false;
    if (item.role === "owner" && !isOwner) return false;
    return true;
  };

  const isItemDisabled = (item: DataItem) => {
    if (!item.feature) return false;
    return !hasFeature(item.feature);
  };

  const menuItems = groupedData.map((group) => {
    if (group.heading === "System" && (!isAdmin || isCloud())) {
      return null;
    }

    return (
      <div key={group.heading}>
        <Text c="dimmed" className={classes.linkHeader}>
          {t(group.heading)}
        </Text>
        {group.items.map((item) => {
          if (!canShowItem(item)) {
            return null;
          }

          let prefetchHandler: any;
          switch (item.label) {
            case "Members":
              prefetchHandler = prefetchWorkspaceMembers;
              break;
            case "Spaces":
              prefetchHandler = prefetchSpaces;
              break;
            case "Groups":
              prefetchHandler = prefetchGroups;
              break;
            case "Billing":
              prefetchHandler = prefetchBilling;
              break;
            case "License & Edition":
              if (entitlements?.tier !== "free") {
                prefetchHandler = prefetchLicense;
              }
              break;
            case "Security & SSO":
              prefetchHandler = prefetchSsoProviders;
              break;
            case "Public sharing":
              prefetchHandler = prefetchShares;
              break;
            case "API keys":
              prefetchHandler = prefetchApiKeys;
              break;
            case "API management":
              prefetchHandler = prefetchApiKeyManagement;
              break;
            case "Audit log":
              prefetchHandler = prefetchAuditLogs;
              break;
            default:
              break;
          }

          const isDisabled = isItemDisabled(item);
          const linkElement = (
            <Link
              onMouseEnter={!isDisabled ? prefetchHandler : undefined}
              className={classes.link}
              data-active={active.startsWith(item.path) || undefined}
              data-disabled={isDisabled || undefined}
              key={item.label}
              to={isDisabled ? "#" : item.path}
              onClick={(e) => {
                if (isDisabled) {
                  e.preventDefault();
                  return;
                }
                if (mobileSidebarOpened) {
                  toggleMobileSidebar();
                }
              }}
              style={{
                opacity: isDisabled ? 0.5 : 1,
                cursor: isDisabled ? "not-allowed" : "pointer",
              }}
            >
              <item.icon className={classes.linkIcon} stroke={2} />
              <span>{t(item.label)}</span>
            </Link>
          );

          if (isDisabled) {
            return (
              <Tooltip
                key={item.label}
                label={upgradeLabel}
                position="right"
                withArrow
              >
                {linkElement}
              </Tooltip>
            );
          }

          return linkElement;
        })}
      </div>
    );
  });

  return (
    <div className={classes.navbar}>
      <Group className={classes.title} justify="flex-start">
        <ActionIcon
          onClick={() => {
            goBack();
            if (mobileSidebarOpened) {
              toggleMobileSidebar();
            }
          }}
          variant="transparent"
          c="gray"
          aria-label="Back"
        >
          <IconArrowLeft stroke={2} />
        </ActionIcon>
        <Text fw={500}>{t("Settings")}</Text>
      </Group>

      <ScrollArea w="100%">{menuItems}</ScrollArea>

      {!isCloud() && <AppVersion />}

      {isCloud() && (
        <div className={classes.text}>
          <Text
            size="sm"
            c="dimmed"
            component="a"
            href="mailto:help@docmost.com"
          >
            help@docmost.com
          </Text>
        </div>
      )}
    </div>
  );
}
