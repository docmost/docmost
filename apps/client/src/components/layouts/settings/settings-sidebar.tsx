import React, { useState } from "react";
import { Group, Text, ScrollArea, ActionIcon, rem } from "@mantine/core";
import {
  IconFingerprint,
  IconUser,
  IconSettings,
  IconUsers,
  IconArrowLeft,
  IconUsersGroup,
  IconSpaces,
} from "@tabler/icons-react";
import { Link, useLocation } from "react-router-dom";
import classes from "./settings.module.css";

interface DataItem {
  label: string;
  icon: React.ElementType;
  path: string;
}

interface DataGroup {
  heading: string;
  items: DataItem[];
}

const groupedData: DataGroup[] = [
  {
    heading: "Account",
    items: [
      { label: "Profile", icon: IconUser, path: "/settings/profile" },
      { label: "Preferences", icon: IconUser, path: "/settings/preferences" },
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
      { label: "Groups", icon: IconUsersGroup, path: "/settings/groups" },
      { label: "Spaces", icon: IconSpaces, path: "/settings/spaces" },
    ],
  },
];

export default function SettingsSidebar() {
  const pathname = useLocation().pathname;
  const [active, setActive] = useState(pathname);

  const menuItems = groupedData.map((group) => (
    <div key={group.heading}>
      <Text c="dimmed" className={classes.linkHeader}>
        {group.heading}
      </Text>
      {group.items.map((item) => (
        <Link
          className={classes.link}
          data-active={active.startsWith(item.path) || undefined}
          key={item.label}
          to={item.path}
          onClick={() => {
            setActive(item.path);
          }}
        >
          <item.icon className={classes.linkIcon} stroke={2} />
          <span>{item.label}</span>
        </Link>
      ))}
    </div>
  ));

  return (
    <nav className={classes.navbar}>
      <div>
        <Group className={classes.header} justify="flex-start">
          <ActionIcon
            component={Link}
            to="/home"
            variant="transparent"
            c="gray"
            aria-label="Home"
          >
            <IconArrowLeft stroke={2} />
          </ActionIcon>
          <Text fw={500}>Settings</Text>
        </Group>

        <ScrollArea h="80vh" w="100%">
          {menuItems}
        </ScrollArea>
      </div>

      <div className={classes.footer}>
        <Link to="/home" className={classes.link}>
          <IconArrowLeft className={classes.linkIcon} stroke={1.5} />
          <span>Return to the app</span>
        </Link>
      </div>
    </nav>
  );
}
