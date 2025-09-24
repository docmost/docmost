import { useAtom } from "jotai";
import { focusAtom } from "jotai-optics";
import * as z from "zod";
import { useForm, zodResolver } from "@mantine/form";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom.ts";
import { updateUser } from "@/features/user/services/user-service.ts";
import { IUser } from "@/features/user/types/user.types.ts";
import { useState } from "react";
import { TextInput, Button } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";

const formSchema = z.object({
  name: z.string().min(1).max(40),
});

type FormValues = z.infer<typeof formSchema>;

const userAtom = focusAtom(currentUserAtom, (optic) => optic.prop("user"));

export default function AccountNameForm() {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [currentUser] = useAtom(currentUserAtom);
  const [, setUser] = useAtom(userAtom);

  const form = useForm<FormValues>({
    validate: zodResolver(formSchema),
    initialValues: {
      name: currentUser?.user.name,
    },
  });

  async function handleSubmit(data: Partial<IUser>) {
    setIsLoading(true);

    try {
      const updatedUser = await updateUser(data);
      setUser(updatedUser);
      notifications.show({
        message: t("Updated successfully"),
      });
    } catch (err) {
      console.log(err);
      notifications.show({
        message: t("Failed to update data"),
        color: "red",
      });
    }

    setIsLoading(false);
  }

  return (
    <form onSubmit={form.onSubmit(handleSubmit)}>
      <TextInput
        id="name"
        label={t("Name")}
        placeholder={t("Your name")}
        variant="filled"
        {...form.getInputProps("name")}
      />
      <Button type="submit" mt="sm" disabled={isLoading} loading={isLoading}>
        {t("Save")}
      </Button>
    </form>
  );
}

/*
<div className={classes.controls}>
          <TextInput
            placeholder="Your email"
            classNames={{ input: classes.input, root: classes.inputWrapper }}
          />
          <Button className={classes.control}>Subscribe</Button>
        </div>
*/
