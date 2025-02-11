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
} from "@mantine/core";
import classes from "../../features/auth/components/auth.module.css";
import { getCheckHostname } from "@/features/workspace/services/workspace-service.ts";
import { useState } from "react";
import { getSubdomainHost } from "@/lib/config.ts";
import { Link } from "react-router-dom";
import APP_ROUTE from "@/lib/app-route.ts";

const formSchema = z.object({
  hostname: z.string().min(1, { message: "subdomain is required" }),
});

export function CloudLoginForm() {
  const [isLoading, setIsLoading] = useState<boolean>(false);

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
      <Container size={420} my={40} className={classes.container}>
        <Box p="xl" mt={200}>
          <Title order={2} ta="center" fw={500} mb="md">
            Login
          </Title>

          <form onSubmit={form.onSubmit(onSubmit)}>
            <TextInput
              type="text"
              placeholder="e.g my-team"
              description="Enter your workspace hostname to log into"
              label="Workspace hostname"
              rightSection={<Text fw={500}>.{getSubdomainHost()}</Text>}
              rightSectionWidth={150}
              withErrorStyles={false}
              {...form.getInputProps("hostname")}
            />
            <Button type="submit" fullWidth mt="xl" loading={isLoading}>
              Continue
            </Button>
          </form>
        </Box>
      </Container>

      <Text ta="center">
        Don't have a workspace?{" "}
        <Anchor component={Link} to={APP_ROUTE.AUTH.CREATE_WORKSPACE} fw={500}>
          Create new workspace
        </Anchor>
      </Text>
    </div>
  );
}
