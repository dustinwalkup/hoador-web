"use client";

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Users } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useJoinCommunity } from "../hooks/use-auth-mutations";
import { joinCodeSchema, type JoinCodeData } from "../schemas/auth-schemas";

export function JoinCodeForm() {
  const mutation = useJoinCommunity();

  const {
    register,
    handleSubmit,
    formState: { errors },
    control,
    setValue,
  } = useForm<JoinCodeData>({
    resolver: zodResolver(joinCodeSchema),
    mode: "onChange",
  });

  const joinCodeValue = useWatch({ control, name: "joinCode" });

  // Auto-uppercase the join code as user types
  const handleJoinCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const upperValue = e.target.value.toUpperCase();
    setValue("joinCode", upperValue, { shouldValidate: true });
  };

  // Handle form submission with client-side validation first
  const onSubmit = async (data: JoinCodeData) => {
    try {
      await mutation.mutateAsync({ joinCode: data.joinCode });
    } catch {
      // Error is handled by the mutation hook
    }
  };

  return (
    <>
      <div className="space-y-6">
        <div className="space-y-4">
          {/* Error */}
          {mutation.isError && (
            <Alert variant="destructive">
              <AlertDescription>
                {mutation.error instanceof Error
                  ? mutation.error.message
                  : "Failed to join community"}
              </AlertDescription>
            </Alert>
          )}

          <form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-4"
            noValidate
          >
            <div className="space-y-2">
              <Label htmlFor="joinCode">Community join code</Label>
              <Input
                id="joinCode"
                {...register("joinCode")}
                value={joinCodeValue || ""}
                onChange={handleJoinCodeChange}
                placeholder="Enter your join code"
                disabled={mutation.isPending}
                className={cn(
                  "text-center font-mono text-lg tracking-wider uppercase",
                  errors.joinCode && "border-red-500",
                )}
                autoComplete="off"
                maxLength={20}
              />

              {/* Client-side validation error */}
              {errors.joinCode && (
                <p className="text-sm text-red-600">
                  {errors.joinCode.message}
                </p>
              )}

              <p className="text-muted-foreground text-xs">
                This code was provided by your community administrator
              </p>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Joining community...
                </>
              ) : (
                <>
                  <Users className="mr-2 h-4 w-4" />
                  Join community
                </>
              )}
            </Button>
          </form>
        </div>

        <div className="text-muted-foreground text-center text-xs">
          Don&apos;t have a join code? Contact your community administrator.
        </div>
      </div>
    </>
  );
}
