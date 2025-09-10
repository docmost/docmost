import { Box } from "@mantine/core";
import React from "react";

interface ResponsiveSettingsRowProps {
  children: React.ReactNode;
}

export function ResponsiveSettingsRow({ children }: ResponsiveSettingsRowProps) {
  return (
    <Box
      style={{
        display: "flex",
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "1rem",
        flexWrap: "wrap",
      }}
    >
      {children}
    </Box>
  );
}

interface ResponsiveSettingsContentProps {
  children: React.ReactNode;
}

export function ResponsiveSettingsContent({ children }: ResponsiveSettingsContentProps) {
  return (
    <Box style={{ flex: "1 1 300px", minWidth: 0 }}>
      {children}
    </Box>
  );
}

interface ResponsiveSettingsControlProps {
  children: React.ReactNode;
}

export function ResponsiveSettingsControl({ children }: ResponsiveSettingsControlProps) {
  return (
    <Box style={{ flex: "0 0 auto" }}>
      {children}
    </Box>
  );
}
