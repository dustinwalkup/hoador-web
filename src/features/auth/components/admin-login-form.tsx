"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { loginSchema, type LoginData } from "../schemas/auth-schemas";
import { useAdminLogin } from "../hooks/use-auth-mutations";

export function AdminLoginForm() {
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const mutation = useAdminLogin();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginData>({
    resolver: zodResolver(loginSchema),
    mode: "onChange",
  });

  // Handle form submission
  const onSubmit = async (data: LoginData) => {
    try {
      await mutation.mutateAsync({
        email: data.email,
        password: data.password,
      });
    } catch {
      // Error is handled by the mutation hook
    }
  };

  // Redirect on success
  useEffect(() => {
    if (mutation.isSuccess) {
      router.push("/admin/dashboard");
    }
  }, [mutation.isSuccess, router]);

  return (
    <div className="space-y-6">
      {/* Error Alert */}
      {mutation.isError && (
        <Alert variant="destructive">
          <AlertDescription>
            {mutation.error instanceof Error
              ? mutation.error.message
              : "Failed to login"}
          </AlertDescription>
        </Alert>
      )}

      {/* Email/Password Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="admin@example.com"
            disabled={mutation.isPending}
            {...register("email")}
          />
          {errors.email && (
            <p className="text-sm text-red-600">{errors.email.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              disabled={mutation.isPending}
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute top-1/2 right-3 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              disabled={mutation.isPending}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          {errors.password && (
            <p className="text-sm text-red-600">{errors.password.message}</p>
          )}
        </div>

        <Button type="submit" className="w-full" disabled={mutation.isPending}>
          {mutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Signing in...
            </>
          ) : (
            "Sign in to Admin Panel"
          )}
        </Button>
      </form>
    </div>
  );
}
