import { Group, Box, Button, TextInput, Stack, Textarea } from "@mantine/core";
import React, { useEffect } from "react";
import { useForm, zodResolver } from "@mantine/form";
import * as z from "zod";
import { useNavigate } from "react-router-dom";
import { useCreateSpaceMutation } from "@/features/space/queries/space-query.ts";
import { computeSpaceSlug } from "@/lib";
import { getSpaceUrl } from "@/lib/config.ts";

const formSchema = z.object({
  name: z.string().min(2).max(50),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(
      /^[a-zA-Z0-9]+$/,
      "Space slug must be alphanumeric. No special characters",
    ),
  description: z.string().max(500),
});
type FormValues = z.infer<typeof formSchema>;

export function CreateSpaceForm() {
  const createSpaceMutation = useCreateSpaceMutation();
  const navigate = useNavigate();

  const form = useForm<FormValues>({
    validate: zodResolver(formSchema),
    validateInputOnChange: ["slug"],
    initialValues: {
      name: "",
      slug: "",
      description: "",
    },
  });

  useEffect(() => {
    const name = form.values.name;
    const words = name.trim().split(/\s+/);

    // Check if the last character is a space or if the last word is a single character (indicating it's in progress)
    const lastChar = name[name.length - 1];
    const lastWordIsIncomplete =
      words.length > 1 && words[words.length - 1].length === 1;

    if (lastChar !== " " || lastWordIsIncomplete) {
      const slug = computeSpaceSlug(name);
      form.setFieldValue("slug", slug);
    }
  }, [form.values.name]);

  const handleSubmit = async (data: {
    name?: string;
    slug?: string;
    description?: string;
  }) => {
    const spaceData = {
      name: data.name,
      slug: data.slug,
      description: data.description,
    };

    const createdSpace = await createSpaceMutation.mutateAsync(spaceData);
    navigate(getSpaceUrl(createdSpace.slug));
  };

  return (
    <>
      <Box maw="500" mx="auto">
        <form onSubmit={form.onSubmit((values) => handleSubmit(values))}>
          <Stack>
            <TextInput
              withAsterisk
              id="name"
              label="Space name"
              placeholder="e.g Product Team"
              variant="filled"
              {...form.getInputProps("name")}
            />

            <TextInput
              withAsterisk
              id="slug"
              label="Space slug"
              placeholder="e.g product"
              variant="filled"
              {...form.getInputProps("slug")}
            />

            <Textarea
              id="description"
              label="Space description"
              placeholder="e.g Space for product team"
              variant="filled"
              autosize
              minRows={2}
              maxRows={8}
              {...form.getInputProps("description")}
            />
          </Stack>

          <Group justify="flex-end" mt="md">
            <Button type="submit">Create</Button>
          </Group>
        </form>
      </Box>
    </>
  );
}
