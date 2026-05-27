import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Container,
  Group,
  Paper,
  Radio,
  Select,
  Skeleton,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { Helmet } from "react-helmet-async";
import { IconAlertCircle } from "@tabler/icons-react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useCreateCrMutation } from "../hooks/useChangeRequests";
import { useServicesQuery } from "@/docops/services/hooks/useServices";
import type { CreateCrPayload, CrImpact, CrPriority } from "../types/cr.types";
import { getAppName } from "@/lib/config";

interface FormValues {
  serviceId: string;
  pageId: string;
  title: string;
  description: string;
  justification: string;
  priority: CrPriority;
  impact: CrImpact;
  dueDate: string;
}

export default function ChangeRequestCreatePage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const serviceCode = searchParams.get("service") ?? "";
  const createMutation = useCreateCrMutation();

  const { data: servicesData, isLoading: servicesLoading } = useServicesQuery({
    limit: 100,
  });

  const serviceOptions =
    servicesData?.items.map((s) => ({
      value: s.id,
      label: s.name,
      pageId: s.rootPageId ?? "",
    })) ?? [];

  const preselected = serviceCode
    ? servicesData?.items.find((s) => s.code === serviceCode)
    : undefined;

  const form = useForm<FormValues>({
    initialValues: {
      serviceId: preselected?.id ?? "",
      pageId: preselected?.rootPageId ?? "",
      title: "",
      description: "",
      justification: "",
      priority: "MEDIUM",
      impact: "MEDIUM",
      dueDate: "",
    },
    validate: {
      serviceId: (v) => (!v ? t("Service is required") : null),
      pageId: (v) =>
        !v
          ? t("Service has no root page. Configure the service space first.")
          : null,
      title: (v) =>
        v.trim().length < 3 ? t("Title must be at least 3 characters") : null,
      description: (v) =>
        v.trim().length < 3
          ? t("Description must be at least 3 characters")
          : null,
      justification: (v) =>
        v.trim().length < 30
          ? t("Justification must be at least 30 characters")
          : null,
    },
  });

  useEffect(() => {
    if (preselected) {
      form.setValues({
        serviceId: preselected.id,
        pageId: preselected.rootPageId ?? "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselected?.id]);

  const [noPageError, setNoPageError] = useState(false);

  const handleServiceChange = (val: string | null) => {
    const svc = servicesData?.items.find((s) => s.id === val);
    if (svc) {
      if (!svc.rootPageId) {
        setNoPageError(true);
        form.setValues({ serviceId: svc.id, pageId: "" });
      } else {
        setNoPageError(false);
        form.setValues({ serviceId: svc.id, pageId: svc.rootPageId });
      }
    }
  };

  const handleSubmit = (values: FormValues) => {
    const payload: CreateCrPayload = {
      serviceId: values.serviceId,
      pageId: values.pageId,
      title: values.title.trim(),
      description: values.description.trim(),
      justification: values.justification.trim(),
      priority: values.priority,
      impact: values.impact,
      dueDate: values.dueDate || undefined,
    };
    createMutation.mutate(payload);
  };

  return (
    <>
      <Helmet>
        <title>
          {t("New Change Request")} — {getAppName()}
        </title>
      </Helmet>

      <Container size="700" pt="xl">
        <Title order={2} mb="lg">
          {t("New Change Request")}
        </Title>

        {createMutation.isError && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" mb="md">
            {(createMutation.error as any)?.response?.data?.message ??
              t("Failed to create change request. Please try again.")}
          </Alert>
        )}

        <Paper withBorder p="lg" radius="md">
          <form onSubmit={form.onSubmit(handleSubmit)} noValidate>
            <Stack gap="md">
              {servicesLoading ? (
                <Skeleton height={36} />
              ) : (
                <Select
                  label={t("Service")}
                  placeholder={t("Select service...")}
                  required
                  searchable
                  disabled={!!serviceCode && !!preselected}
                  data={serviceOptions}
                  value={form.values.serviceId || null}
                  onChange={handleServiceChange}
                  error={form.errors.serviceId}
                  aria-label={t("Service")}
                />
              )}

              {noPageError && (
                <Alert icon={<IconAlertCircle size={14} />} color="orange" p="xs">
                  <Text size="sm">
                    {t("Service has no root page. Configure the service space first.")}{" "}
                    <Text
                      component={Link}
                      to={`/services/${form.values.serviceId}`}
                      size="sm"
                      c="blue"
                    >
                      {t("View service")}
                    </Text>
                  </Text>
                </Alert>
              )}

              <TextInput
                label={t("Title")}
                placeholder={t("Short descriptive title")}
                required
                aria-label={t("Title")}
                {...form.getInputProps("title")}
              />

              <Textarea
                label={t("Description")}
                placeholder={t("What needs to change and why")}
                required
                minRows={3}
                maxRows={6}
                autosize
                aria-label={t("Description")}
                {...form.getInputProps("description")}
              />

              <Textarea
                label={t("Justification")}
                placeholder={t("Business or technical justification (min 30 characters)")}
                required
                minRows={3}
                maxRows={6}
                autosize
                description={`${form.values.justification.length} / 30 ${t("characters minimum")}`}
                aria-label={t("Justification")}
                {...form.getInputProps("justification")}
              />

              <Radio.Group
                label={t("Priority")}
                required
                aria-label={t("Priority")}
                {...form.getInputProps("priority")}
              >
                <Group mt="xs" gap="md">
                  {(["LOW", "MEDIUM", "HIGH", "CRITICAL"] as CrPriority[]).map((p) => (
                    <Radio key={p} value={p} label={t(p)} />
                  ))}
                </Group>
              </Radio.Group>

              <Radio.Group
                label={t("Impact")}
                required
                aria-label={t("Impact")}
                {...form.getInputProps("impact")}
              >
                <Group mt="xs" gap="md">
                  {(["LOW", "MEDIUM", "HIGH"] as CrImpact[]).map((i) => (
                    <Radio key={i} value={i} label={t(i)} />
                  ))}
                </Group>
              </Radio.Group>

              <TextInput
                label={t("Due date (optional)")}
                type="date"
                aria-label={t("Due date (optional)")}
                {...form.getInputProps("dueDate")}
              />

              <Group justify="flex-end" mt="sm">
                <Button
                  component={Link}
                  to="/change-requests"
                  variant="default"
                  type="button"
                >
                  {t("Cancel")}
                </Button>
                <Button
                  type="submit"
                  loading={createMutation.isPending}
                  disabled={noPageError}
                >
                  {t("Create Change Request")}
                </Button>
              </Group>
            </Stack>
          </form>
        </Paper>
      </Container>
    </>
  );
}
