import { Alert, Container, Paper, Text, Title } from "@mantine/core";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { IconAlertCircle } from "@tabler/icons-react";
import { getAppName } from "@/lib/config";
import type { CreateServicePayload } from "../types/service.types";
import { useCreateServiceMutation } from "../hooks/useServices";
import { ServiceForm } from "../components/ServiceForm";

export default function ServiceCreatePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const createMutation = useCreateServiceMutation();

  const handleSubmit = (payload: CreateServicePayload) => {
    createMutation.mutate(payload);
  };

  return (
    <>
      <Helmet>
        <title>
          {t("New service")} - {getAppName()}
        </title>
      </Helmet>

      <Container size="600" pt="xl">
        <Title order={2} mb="lg">
          {t("New service")}
        </Title>

        {createMutation.isError && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" mb="md">
            {(createMutation.error as any)?.response?.data?.message ??
              t("Failed to create service. Please try again.")}
          </Alert>
        )}

        <Paper withBorder p="lg" radius="md">
          <ServiceForm
            onSubmit={handleSubmit}
            isLoading={createMutation.isPending}
            onCancel={() => navigate("/services")}
          />
        </Paper>
      </Container>
    </>
  );
}
