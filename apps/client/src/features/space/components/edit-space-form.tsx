import { Group, Box, Button, TextInput, Stack, Textarea } from "@mantine/core";
import React from "react";
import { useForm, zodResolver } from "@mantine/form";
import * as z from "zod";
import { useUpdateSpaceMutation } from "@/features/space/queries/space-query.ts";
import { ISpace } from "@/features/space/types/space.types.ts";

const formSchema = z.object({
  name: z.string().min(2).max(50),
  description: z.string().max(250),
});

type FormValues = z.infer<typeof formSchema>;
interface EditSpaceFormProps {
  space: ISpace;
  readOnly?: boolean;
}
export function EditSpaceForm({ space, readOnly }: EditSpaceFormProps) {
  const updateSpaceMutation = useUpdateSpaceMutation();

  const form = useForm<FormValues>({
    validate: zodResolver(formSchema),
    initialValues: {
      name: space?.name,
      description: space?.description || "",
    },
  });

  const handleSubmit = async (values: {
    name?: string;
    description?: string;
  }) => {
    const spaceData: Partial<ISpace> = {
      spaceId: space.id,
    };
    if (form.isDirty("name")) {
      spaceData.name = values.name;
    }
    if (form.isDirty("description")) {
      spaceData.description = values.description;
    }

    await updateSpaceMutation.mutateAsync(spaceData);
    form.resetDirty();
  };

  return (
    <>
      <Box>
        <form onSubmit={form.onSubmit((values) => handleSubmit(values))}>
          <Stack>
            <TextInput
              id="name"
              label="Name"
              placeholder="e.g Sales"
              variant="filled"
              readOnly={readOnly}
              {...form.getInputProps("name")}
            />

            <TextInput
              id="slug"
              label="Slug"
              variant="filled"
              readOnly
              value={space.slug}
            />

            <Textarea
              id="description"
              label="Description"
              placeholder="e.g Space for sales team to collaborate"
              variant="filled"
              readOnly={readOnly}
              autosize
              minRows={1}
              maxRows={3}
              {...form.getInputProps("description")}
            />
          </Stack>

          {!readOnly && (
            <Group justify="flex-end" mt="md">
              <Button type="submit" disabled={!form.isDirty()}>
                Save
              </Button>
            </Group>
          )}
        </form>
      </Box>
    </>
  );
}
