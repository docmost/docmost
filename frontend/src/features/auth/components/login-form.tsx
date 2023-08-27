"use client";

import * as React from "react";
import * as z from "zod";

import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Icons } from "@/components/icons";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import useAuth from "@/features/auth/hooks/use-auth";
import { ILogin } from "@/features/auth/types/auth.types";

const formSchema = z.object({
  email: z.string({ required_error: "email is required" }).email({ message: "Invalid email address" }),
  password: z.string({ required_error: "password is required" }),
});

interface UserAuthFormProps extends React.HTMLAttributes<HTMLDivElement> {
}

export function LoginForm({ className, ...props }: UserAuthFormProps) {
  const { register, handleSubmit, formState: { errors } }
    = useForm<ILogin>({ resolver: zodResolver(formSchema) });

  const { signIn, isLoading } = useAuth();

  async function onSubmit(data: ILogin) {
    await signIn(data);
  }

  return (
    <>
      <div className={cn("grid gap-6 space-y-5", className)} {...props}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-2">

            <div className="space-y-2">
              <Label className="" htmlFor="email">
                Email
              </Label>
              <Input
                id="email"
                placeholder="name@example.com"
                type="email"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect="off"
                required
                disabled={isLoading}
                {...register("email")} />
              {errors?.email && (
                <p className="px-1 text-xs text-red-600">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">
                Password
              </Label>
              <Input
                id="password"
                placeholder="Enter your password"
                type="password"
                autoComplete="off"
                required
                disabled={isLoading}
                {...register("password")} />
              {errors?.password && (
                <p className="px-1 text-xs text-red-600">
                  {errors.password.message}
                </p>
              )}
            </div>

            <Button className={cn(buttonVariants(), "mt-2")} disabled={isLoading}>
              {isLoading && (
                <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
              )}
              Sign In
            </Button>
          </div>
        </form>

      </div>
    </>
  );
}
