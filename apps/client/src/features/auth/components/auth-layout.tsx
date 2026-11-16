import React from "react";
import { Group, Text } from "@mantine/core";
import { MAIN_CONTENT_ID } from "@/components/ui/skip-to-main.tsx";
import AnnouncementBanners from "@/ee/announcement/components/announcement-banners.tsx";
import classes from "./auth.module.css";

type AuthLayoutProps = {
  children: React.ReactNode;
};

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <>
      <AnnouncementBanners surface="public" />
      <Group justify="center" gap={8} className={classes.logo}>
        <img
          src="/icons/favicon-32x32.png"
          alt="Docmost"
          width={22}
          height={22}
        />
        <Text size="28px" fw={700} style={{ userSelect: "none" }}>
          Docmost
        </Text>
      </Group>
      <main id={MAIN_CONTENT_ID} tabIndex={-1}>{children}</main>
    </>
  );
}
