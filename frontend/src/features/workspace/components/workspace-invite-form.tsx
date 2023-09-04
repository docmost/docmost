"use client";

import * as z from "zod";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { IconTrashX } from "@tabler/icons-react";
import ButtonWithIcon from "@/components/ui/button-with-icon";
import { Button } from "@/components/ui/button";

enum UserRole {
  GUEST = "guest",
  MEMBER = "member",
  OWNER = "owner",
}

const inviteFormSchema = z.object({
  members: z
    .array(
      z.object({
        email: z.string({
          required_error: "Email is required",
        }).email({ message: "Please enter a valid email" }),
        role: z
          .string({
            required_error: "Please select a role",
          }),
      }),
    ),
});

type InviteFormValues = z.infer<typeof inviteFormSchema>

const defaultValues: Partial<InviteFormValues> = {
  members: [
    { email: "user@example.com", role: "member" },
  ],
};

export function WorkspaceInviteForm() {

  const form = useForm<InviteFormValues>({
    resolver: zodResolver(inviteFormSchema),
    defaultValues,
    mode: "onChange",
  });

  const { fields, append, remove } = useFieldArray({
    name: "members",
    control: form.control,
  });

  function onSubmit(data: InviteFormValues) {
    console.log(data);
  }

  return (

    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <div>
          {
            fields.map((field, index) => {
              const key = index.toString();
              return (
                <div key={key} className="flex justify-between items-center py-2 gap-2">

                  <div className="flex-grow">
                    {index === 0 && <FormLabel>Email</FormLabel>}
                    <FormField
                      control={form.control}
                      key={field.id}
                      name={`members.${index}.email`}
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex-grow">
                    {index === 0 && <FormLabel>Role</FormLabel>}

                    <FormField
                      control={form.control}
                      key={field.id}
                      name={`members.${index}.role`}
                      render={({ field }) => (
                        <FormItem>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a role for this member" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {
                                Object.keys(UserRole).map((key) => {
                                  const value = UserRole[key as keyof typeof UserRole];
                                  return (
                                    <SelectItem key={key} value={value}>
                                      {key.charAt(0).toUpperCase() + key.slice(1).toLowerCase()}
                                    </SelectItem>
                                  );
                                })
                              }
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                  </div>

                  <div className="flex items-center">
                    {index != 0 &&
                      <ButtonWithIcon
                        icon={<IconTrashX size={16} />}
                        variant="secondary"
                        onClick={() => remove(index)}
                      />
                    }
                  </div>

                </div>
              );
            })
          }

          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => append({ email: "", role: UserRole.MEMBER })}
          >
            Add
          </Button>

        </div>

        <div className="flex justify-end">
          <Button type="submit">Send Invitation</Button>
        </div>
      </form>
    </Form>

  );

}
