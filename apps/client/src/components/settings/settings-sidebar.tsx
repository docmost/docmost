import React, { useEffect, useState } from "react";
import { Group, Text, ScrollArea, ActionIcon } from "@mantine/core";
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
} from "@tabler/icons-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import classes from "./settings.module.css";
import { useTranslation } from "react-i18next";
import { isCloud } from "@/lib/config.ts";
import useUserRole from "@/hooks/use-user-role.tsx";
import { useAtom } from "jotai/index";
import { workspaceAtom } from "@/features/user/atoms/current-user-atom.ts";
import {
  prefetchBilling,
  prefetchGroups,
  prefetchLicense,
  prefetchSpaces,
  prefetchSsoProviders,
  prefetchWorkspaceMembers,
} from "@/components/settings/settings-queries.tsx";

interface DataItem {
  label: string;
  icon: React.ElementType;
  path: string;
  isCloud?: boolean;
  isEnterprise?: boolean;
  isAdmin?: boolean;
  isSelfhosted?: boolean;
}

interface DataGroup {
  heading: string;
  items: DataItem[];
}

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
    ],
  },
  {
    heading: "Workspace",
    items: [
      { label: "General", icon: IconSettings, path: "/settings/workspace" },
      {
        label: "Members",
        icon: IconUsers,
        path: "/settings/members",
      },
      {
        label: "Billing",
        icon: IconCoin,
        path: "/settings/billing",
        isCloud: true,
        isAdmin: true,
      },
      {
        label: "Security & SSO",
        icon: IconLock,
        path: "/settings/security",
        isCloud: true,
        isEnterprise: true,
        isAdmin: true,
      },
      { label: "Groups", icon: IconUsersGroup, path: "/settings/groups" },
      { label: "Spaces", icon: IconSpaces, path: "/settings/spaces" },
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
  const navigate = useNavigate();
  const { isAdmin } = useUserRole();
  const [workspace] = useAtom(workspaceAtom);

  useEffect(() => {
    setActive(location.pathname);
  }, [location.pathname]);

  const canShowItem = (item: DataItem) => {
    if (item.isCloud && item.isEnterprise) {
      if (!(isCloud() || workspace?.hasLicenseKey)) return false;
      return item.isAdmin ? isAdmin : true;
    }

    if (item.isCloud) {
      return isCloud() ? (item.isAdmin ? isAdmin : true) : false;
    }

    if (item.isSelfhosted) {
      return !isCloud() ? (item.isAdmin ? isAdmin : true) : false;
    }

    if (item.isEnterprise) {
      return workspace?.hasLicenseKey ? (item.isAdmin ? isAdmin : true) : false;
    }

    if (item.isAdmin) {
      return isAdmin;
    }

    return true;
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
              if (workspace?.hasLicenseKey) {
                prefetchHandler = prefetchLicense;
              }
              break;
            case "Security & SSO":
              prefetchHandler = prefetchSsoProviders;
              break;
            default:
              break;
          }

          return (
            <Link
              onMouseEnter={prefetchHandler}
              className={classes.link}
              data-active={active.startsWith(item.path) || undefined}
              key={item.label}
              to={item.path}
            >
              <item.icon className={classes.linkIcon} stroke={2} />
              <span>{t(item.label)}</span>
            </Link>
          );
        })}
      </div>
    );
  });

  return (
    <div className={classes.navbar}>
      <Group className={classes.title} justify="flex-start">
        <ActionIcon
          onClick={() => navigate(-1)}
          variant="transparent"
          c="gray"
          aria-label="Back"
        >
          <IconArrowLeft stroke={2} />
        </ActionIcon>
        <Text fw={500}>{t("Settings")}</Text>
      </Group>

      <ScrollArea w="100%">{menuItems}</ScrollArea>
      {!isCloud() && (
        <div className={classes.text}>
          <Text
            size="sm"
            c="dimmed"
            component="a"
            href="https://github.com/docmost/docmost/releases"
            target="_blank"
          >
            v{APP_VERSION}
          </Text>
        </div>
      )}

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
