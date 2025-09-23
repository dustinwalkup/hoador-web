"use client";

import { useActionState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Users } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { joinCommunityAction } from "../actions/join-community";
import { joinCodeSchema, type JoinCodeData } from "../schemas/auth-schemas";

export function JoinCodeForm() {
  const [isTransitionPending, startTransition] = useTransition();
  const [state, formAction, isPending] = useActionState(joinCommunityAction, {
    success: false,
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<JoinCodeData>({
    resolver: zodResolver(joinCodeSchema),
    mode: "onChange",
  });

  const joinCodeValue = watch("joinCode");

  // Auto-uppercase the join code as user types
  const handleJoinCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const upperValue = e.target.value.toUpperCase();
    setValue("joinCode", upperValue, { shouldValidate: true });
  };

  // Handle form submission with client-side validation first
  const onSubmit = async (data: JoinCodeData) => {
    // Create FormData and call the server action
    startTransition(async () => {
      const formData = new FormData();
      formData.append("joinCode", data.joinCode);
      formAction(formData);
    });
  };

  return (
    <>
      <div className="space-y-6">
        <div className="space-y-4">
          {/* Server-side error */}
          {state?.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
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
                disabled={isPending || isTransitionPending}
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

            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? (
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
