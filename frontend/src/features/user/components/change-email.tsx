"use client";

import { Dialog, DialogTrigger } from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import * as z from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Icons } from "@/components/icons";
import { useState } from "react";
import { useAtom } from "jotai";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";


export default function ChangeEmail() {
  const [currentUser] = useAtom(currentUserAtom);

  return (
    <div className="flex items-center justify-between space-x-4 mt-5">
      <div>
        <h4 className="text-xl font-medium">Email</h4>
        <p className="text-sm text-muted-foreground">{currentUser.user.email}</p>
      </div>
      <ChangeEmailDialog />
    </div>
  );
}

function ChangeEmailDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Change email</Button>
      </DialogTrigger>
      <DialogContent className="w-[350px]">
        <DialogHeader>
          <DialogTitle>
            Change email
          </DialogTitle>
          <DialogDescription>
            To change your email, you have to enter your password and new email.
          </DialogDescription>
        </DialogHeader>

        <ChangePasswordForm />

      </DialogContent>
    </Dialog>

  );
}

const changeEmailSchema = z.object({
  password: z.string({ required_error: "your current password is required" }).min(8),
  email: z.string({ required_error: "New email is required" }).email()
});

type ChangeEmailFormValues = z.infer<typeof changeEmailSchema>

function ChangePasswordForm() {
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<ChangeEmailFormValues>({
    resolver: zodResolver(changeEmailSchema),
    defaultValues: {
      password: "",
      email: "",
    },
  });

  function onSubmit(data: ChangeEmailFormValues) {
    setIsLoading(true);
    console.log(data);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="font-semibold">Password</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="password" placeholder="Enter your password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="font-semibold">New email</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="email" placeholder="Enter your new email" {...field} />
              </FormControl>
              <FormDescription>Enter your new preferred email</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end">
          <Button type="submit" disabled={isLoading}>
            {isLoading && <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />}
            Change email
          </Button>
        </div>

      </form>
    </Form>
  );
}
