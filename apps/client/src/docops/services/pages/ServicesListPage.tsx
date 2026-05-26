import { useState } from "react";
import {
  Alert,
  Button,
  Container,
  Grid,
  Group,
  Pagination,
  Skeleton,
  Text,
  Title,
} from "@mantine/core";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { IconPlus, IconAlertCircle } from "@tabler/icons-react";
import { getAppName } from "@/lib/config";
import useCurrentUser from "@/features/user/hooks/use-current-user";
import type { ListServicesParams } from "../types/service.types";
import { useServicesQuery } from "../hooks/useServices";
import { ServiceCard } from "../components/ServiceCard";
import { ServiceFilters } from "../components/ServiceFilters";

const PAGE_SIZE = 20;

export default function ServicesListPage() {
  const { t } = useTranslation();
  const { data: currentUserData } = useCurrentUser();
  const user = currentUserData?.user;
  const canCreate = user?.role === "owner" || user?.role === "admin";

  const [filters, setFilters] = useState<ListServicesParams>({
    limit: PAGE_SIZE,
    offset: 0,
  });
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useServicesQuery(filters);

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  const handlePageChange = (p: number) => {
    setPage(p);
    setFilters((f) => ({ ...f, offset: (p - 1) * PAGE_SIZE }));
  };

  const handleFiltersChange = (params: ListServicesParams) => {
    setPage(1);
    setFilters({ ...params, limit: PAGE_SIZE, offset: 0 });
  };

  return (
    <>
      <Helmet>
        <title>
          {t("Service Catalog")} - {getAppName()}
        </title>
      </Helmet>

      <Container size="900" pt="xl">
        <Group justify="space-between" mb="lg">
          <Title order={2}>{t("Service Catalog")}</Title>
          {canCreate && (
            <Button
              component={Link}
              to="/services/new"
              leftSection={<IconPlus size={16} />}
              size="sm"
            >
              {t("New service")}
            </Button>
          )}
        </Group>

        <ServiceFilters value={filters} onChange={handleFiltersChange} />

        {isError && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" mb="md">
            {t("Failed to load services. Please try again.")}
          </Alert>
        )}

        {isLoading ? (
          <Grid>
            {Array.from({ length: 6 }).map((_, i) => (
              <Grid.Col key={i} span={{ base: 12, sm: 6, md: 4 }}>
                <Skeleton height={120} radius="md" />
              </Grid.Col>
            ))}
          </Grid>
        ) : data?.items.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl">
            {t("No services found.")}
          </Text>
        ) : (
          <>
            <Grid>
              {data?.items.map((service) => (
                <Grid.Col key={service.id} span={{ base: 12, sm: 6, md: 4 }}>
                  <ServiceCard service={service} />
                </Grid.Col>
              ))}
            </Grid>

            {totalPages > 1 && (
              <Group justify="center" mt="xl">
                <Pagination
                  total={totalPages}
                  value={page}
                  onChange={handlePageChange}
                  aria-label={t("Services pagination")}
                />
              </Group>
            )}
          </>
        )}
      </Container>
    </>
  );
}
