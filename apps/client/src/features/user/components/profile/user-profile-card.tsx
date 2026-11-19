import { ReactNode, useId } from "react";
import { Paper, Title } from "@mantine/core";

type UserProfileCardProps = {
  title: string;
  children: ReactNode;
};

export function UserProfileCard({ title, children }: UserProfileCardProps) {
  const titleId = useId();

  return (
    <Paper
      component="section"
      aria-labelledby={titleId}
      withBorder
      radius="md"
      p="md"
    >
      <Title order={2} size="h5" fw={600} mb={4} id={titleId}>
        {title}
      </Title>
      {children}
    </Paper>
  );
}
