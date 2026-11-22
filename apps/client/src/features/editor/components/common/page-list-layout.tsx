import type { ReactNode } from "react";
import { ActionIcon } from "@mantine/core";
import { IconRefresh } from "@tabler/icons-react";
import classes from "./page-list.module.css";

export function PageListRefreshButton({
  label,
  loading,
  onClick,
}: {
  label: string;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <ActionIcon
      variant="subtle"
      color="gray"
      size="md"
      aria-label={label}
      title={label}
      loading={loading}
      onClick={onClick}
    >
      <IconRefresh size={16} />
    </ActionIcon>
  );
}

interface PageListLayoutProps {
  heading?: ReactNode;
  headingId?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function PageListLayout({
  heading,
  headingId,
  actions,
  children,
}: PageListLayoutProps) {
  const toolbar = actions && (
    <div className={classes.actions + " print-hide"}>{actions}</div>
  );
  return (
    <div className={heading ? undefined : classes.headless}>
      {heading ? (
        <div className={classes.header}>
          <h3 id={headingId} className={classes.heading}>
            {heading}
          </h3>
          {toolbar}
        </div>
      ) : (
        toolbar
      )}
      <div className={classes.content}>{children}</div>
    </div>
  );
}
