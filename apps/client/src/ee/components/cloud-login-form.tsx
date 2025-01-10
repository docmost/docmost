import * as z from "zod";
import { useForm, zodResolver } from "@mantine/form";
import { Container, Title, TextInput, Button, Box, Text } from "@mantine/core";
import classes from "../../features/auth/components/auth.module.css";
import { getCheckHostname } from "@/features/workspace/services/workspace-service.ts";
import { useState } from "react";

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
      if (checkHostname.found) {
        // todo redirect to login page
        //window.location.href = host;
      } else {
        form.setFieldError("hostname", "We could not find this workspace");
      }
    } catch (err) {
      form.setFieldError("hostname", "An error occurred");
      console.log(err);
    }

    setIsLoading(false);
  }

  return (
    <Container size={420} my={40} className={classes.container}>
      <Box p="xl" mt={200}>
        <Title order={2} ta="center" fw={500} mb="md">
          Login
        </Title>

        <form onSubmit={form.onSubmit(onSubmit)}>
          <TextInput
            type="text"
            placeholder="e.g my-team"
            label="Workspace subdomain"
            rightSection={<Text fw={500}>.docmost.com</Text>}
            rightSectionWidth={120}
            withErrorStyles={false}
            {...form.getInputProps("hostname")}
          />
          <Button type="submit" fullWidth mt="xl" loading={isLoading}>
            Continue
          </Button>
        </form>
      </Box>
    </Container>
  );
}
