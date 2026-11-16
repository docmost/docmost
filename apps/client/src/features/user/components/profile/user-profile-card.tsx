import { ReactNode, useId } from "react";
import { Paper, Text, Title } from "@mantine/core";
import classes from "@/features/user/components/profile/user-profile.module.css";

type UserProfileCardProps = {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
};

export function UserProfileCard({
  title,
  description,
  action,
  children,
}: UserProfileCardProps) {
  const titleId = useId();

  return (
    <Paper
      component="section"
      aria-labelledby={titleId}
      withBorder
      radius="md"
      p="lg"
    >
      <div className={classes.cardHeader}>
        <div className={classes.cardHeading}>
          <Title order={2} size="h5" id={titleId}>
            {title}
          </Title>
          {description && (
            <Text size="sm" c="dimmed">
              {description}
            </Text>
          )}
        </div>
        {action && <div className={classes.cardAction}>{action}</div>}
      </div>
      {children}
    </Paper>
  );
}
