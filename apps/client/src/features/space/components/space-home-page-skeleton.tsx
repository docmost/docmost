import { Container, Skeleton } from "@mantine/core";

export default function SpaceHomePageSkeleton() {
  return (
    <Container size={900} pt={60}>
      <Skeleton height={36} width="50%" mb="xl" />
      <Skeleton height={12} mb="sm" />
      <Skeleton height={12} mb="sm" />
      <Skeleton height={12} width="70%" />
    </Container>
  );
}
