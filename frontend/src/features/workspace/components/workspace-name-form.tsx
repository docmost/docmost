"use client";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAtom } from "jotai";
import { useForm } from "react-hook-form";
import * as z from "zod";
import toast from "react-hot-toast";
import { updateUser } from "@/features/user/services/user-service";
import { useState } from "react";
import { focusAtom } from "jotai-optics";
import { updateWorkspace } from "@/features/workspace/services/workspace-service";
import { IWorkspace } from "@/features/workspace/types/workspace.types";

const profileFormSchema = z.object({
  name: z.string(),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

const workspaceAtom = focusAtom(currentUserAtom, (optic) => optic.prop("workspace"));

export default function WorkspaceNameForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [currentUser] = useAtom(currentUserAtom);
  const [, setWorkspace] = useAtom(workspaceAtom);

  const defaultValues: Partial<ProfileFormValues> = {
    name: currentUser?.workspace?.name,
  };

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues,
  });

  async function onSubmit(data: Partial<IWorkspace>) {
    setIsLoading(true);

    try {
      const updatedWorkspace = await updateWorkspace(data);
      setWorkspace(updatedWorkspace);
      toast.success("Updated successfully");
    } catch (err) {
      console.log(err);
      toast.error("Failed to update data.");
    }

    setIsLoading(false);

  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input className="max-w-md" placeholder="e.g ACME" {...field} />
              </FormControl>
              <FormDescription>
                Your workspace name.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit">Save</Button>
      </form>
    </Form>
  );
}
