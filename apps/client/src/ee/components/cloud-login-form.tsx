import { z } from "zod/v4";
import { useForm } from "@mantine/form";
import { zod4Resolver } from "mantine-form-zod-resolver";
import {
  Container,
  Title,
  TextInput,
  Button,
  Box,
  Text,
  Anchor,
  Divider,
} from "@mantine/core";
import classes from "../../features/auth/components/auth.module.css";
import { getCheckHostname } from "@/features/workspace/services/workspace-service.ts";
import { useState } from "react";
import { getSubdomainHost } from "@/lib/config.ts";
import { Link } from "react-router-dom";
import APP_ROUTE from "@/lib/app-route.ts";
import { useTranslation } from "react-i18next";
import JoinedWorkspaces from "@/ee/components/joined-workspaces.tsx";
import { useJoinedWorkspacesQuery } from "@/ee/cloud/query/cloud-query.ts";
import { findWorkspacesByEmail } from "@/ee/cloud/service/cloud-service.ts";
import { AuthLayout } from "@/features/auth/components/auth-layout.tsx";

const formSchema = z.object({
  hostname: z.string().min(1, { message: "subdomain is required" }),
});

const findWorkspaceSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email" }),
});

export function CloudLoginForm() {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isFindLoading, setIsFindLoading] = useState<boolean>(false);
  const [findEmailSent, setFindEmailSent] = useState<boolean>(false);
  const { data: joinedWorkspaces } = useJoinedWorkspacesQuery();

  const form = useForm<any>({
    validate: zod4Resolver(formSchema),
    initialValues: {
      hostname: "",
    },
  });

  const findForm = useForm<any>({
    validate: zod4Resolver(findWorkspaceSchema),
    initialValues: {
      email: "",
    },
  });

  async function onSubmit(data: { hostname: string }) {
    setIsLoading(true);

    try {
      const checkHostname = await getCheckHostname(data.hostname);
      window.location.href = checkHostname.hostname;
    } catch (err) {
      if (err?.status === 404) {
        form.setFieldError("hostname", "We could not find this workspace");
      } else {
        form.setFieldError("hostname", "An error occurred");
      }
    }

    setIsLoading(false);
  }

  async function onFindSubmit(data: { email: string }) {
    setIsFindLoading(true);

    try {
      await findWorkspacesByEmail(data.email);
      setFindEmailSent(true);
    } catch {
      findForm.setFieldError("email", "An error occurred. Please try again.");
    }

    setIsFindLoading(false);
  }

  return (
    <AuthLayout>
      <Container size={420} className={classes.container}>
        <Box p="xl" className={classes.containerBox}>
          <Title order={2} ta="center" fw={500} mb="md">
            {t("Login")}
          </Title>

          <JoinedWorkspaces />

          {joinedWorkspaces?.length > 0 && (
            <Divider my="xs" label="OR" labelPosition="center" />
          )}

          <form onSubmit={form.onSubmit(onSubmit)}>
            <TextInput
              type="text"
              placeholder="my-team"
              description="Enter your workspace hostname"
              label="Workspace hostname"
              rightSection={<Text fw={500}>.{getSubdomainHost()}</Text>}
              rightSectionWidth={150}
              withErrorStyles={false}
              {...form.getInputProps("hostname")}
            />
            <Button type="submit" fullWidth mt="xl" loading={isLoading}>
              {t("Continue")}
            </Button>
          </form>

          <Divider my="lg" label="or" labelPosition="center" />

          {findEmailSent ? (
            <Text ta="center" size="sm" c="dimmed">
              {t("We've sent you an email with your associated workspaces.")}
            </Text>
          ) : (
            <form onSubmit={findForm.onSubmit(onFindSubmit)}>
              <Text fw={600} mb="xs">
                {t("Find your workspaces")}
              </Text>
              <TextInput
                type="email"
                placeholder="name@company.com"
                description={t(
                  "We'll send a list of your workspaces to this email.",
                )}
                withErrorStyles={false}
                {...findForm.getInputProps("email")}
              />
              <Button
                type="submit"
                fullWidth
                mt="md"
                variant="light"
                loading={isFindLoading}
              >
                {t("Send")}
              </Button>
            </form>
          )}
        </Box>
      </Container>

      <Text ta="center" mb="xl">
        {t("Don't have a workspace?")}{" "}
        <Anchor component={Link} to={APP_ROUTE.AUTH.CREATE_WORKSPACE} fw={500}>
          {t("Create new workspace")}
        </Anchor>
      </Text>
    </AuthLayout>
  );
}
