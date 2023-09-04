"use client";

import { Dialog, DialogTrigger } from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import * as z from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Icons } from "@/components/icons";
import { useState } from "react";

export default function ChangePassword() {
  return (
    <div className="flex items-center justify-between space-x-4 mt-5">
      <div>
        <h4 className="text-xl font-medium">Password</h4>
        <p className="text-sm text-muted-foreground">You can change your password here.</p>
      </div>
      <ChangePasswordDialog />
    </div>
  );
}

function ChangePasswordDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Change password</Button>
      </DialogTrigger>
      <DialogContent className="w-[350px]">
        <DialogHeader>
          <DialogTitle>
            Change password
          </DialogTitle>
          <DialogDescription>
            Your password must be at least a minimum of 8 characters.
          </DialogDescription>
        </DialogHeader>

        <ChangePasswordForm />

      </DialogContent>
    </Dialog>

  );
}

const changePasswordSchema = z.object({
  current: z.string({ required_error: "your current password is required" }).min(1),
  password: z.string({ required_error: "New password is required" }).min(8),
  confirm_password: z.string({ required_error: "Password confirmation is required" }).min(8),
}).refine(data => data.password === data.confirm_password, {
  message: "Your new password and confirmation does not match.",
  path: ["confirm_password"],
});

type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>

function ChangePasswordForm() {
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      current: "",
      password: "",
      confirm_password: "",
    },
  });

  function onSubmit(data: ChangePasswordFormValues) {
    setIsLoading(true);
    console.log(data);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="current"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="font-semibold">Current password</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="current-password" placeholder="Your current password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="font-semibold">New password</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="password" placeholder="Your new password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="confirm_password"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="font-semibold">Repeat new password</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="password" placeholder="Confirm your new password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end">
          <Button type="submit" disabled={isLoading}>
            {isLoading && <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />}
            Change password
          </Button>
        </div>

      </form>
    </Form>
  );
}
