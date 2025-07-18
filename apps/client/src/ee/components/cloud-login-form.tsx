import * as z from "zod";
import { useForm, zodResolver } from "@mantine/form";
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

const formSchema = z.object({
  hostname: z.string().min(1, { message: "subdomain is required" }),
});

export function CloudLoginForm() {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { data: joinedWorkspaces } = useJoinedWorkspacesQuery();

  const form = useForm<any>({
    validate: zodResolver(formSchema),
    initialValues: {
      hostname: "",
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

  return (
    <div>
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
        </Box>
      </Container>

      <Text ta="center">
        {t("Don't have a workspace?")}{" "}
        <Anchor component={Link} to={APP_ROUTE.AUTH.CREATE_WORKSPACE} fw={500}>
          {t("Create new workspace")}
        </Anchor>
      </Text>
    </div>
  );
}
