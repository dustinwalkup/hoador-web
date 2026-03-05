"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Users } from "lucide-react";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SESSION_EXPIRED_MESSAGE } from "../constants";
import { useJoinCommunity } from "../hooks/use-auth-mutations";
import { joinCodeSchema, type JoinCodeData } from "../schemas/auth-schemas";
import { RequestHoadorModal } from "@/features/hoa-inquiries/components/request-hoador-modal";
import { containerVariants, fieldVariants } from "./animated-form-field";

export function JoinCodeForm() {
  const router = useRouter();
  const mutation = useJoinCommunity();

  useEffect(() => {
    if (
      mutation.isError &&
      mutation.error instanceof Error &&
      mutation.error.message === SESSION_EXPIRED_MESSAGE
    ) {
      router.replace("/login?callbackUrl=/join-code");
    }
  }, [mutation.isError, mutation.error, router]);

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
    <motion.div
      className="space-y-6"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
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
          <motion.div variants={fieldVariants} className="space-y-2">
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
              <p className="text-sm text-red-600">{errors.joinCode.message}</p>
            )}

            <p className="text-muted-foreground text-xs">
              This code was provided by your community administrator
            </p>
          </motion.div>

          <motion.div variants={fieldVariants}>
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
          </motion.div>
        </form>
      </div>

      <motion.div
        variants={fieldVariants}
        className="text-muted-foreground text-center text-xs"
      >
        Don&apos;t have a join code? Contact your community administrator.
      </motion.div>

      <motion.div
        variants={fieldVariants}
        className="text-muted-foreground text-center text-xs"
      >
        Want Hoador in your neighborhood?{" "}
        <RequestHoadorModal
          trigger={
            <button
              type="button"
              className="text-primary hover:text-primary/80 underline underline-offset-2"
            >
              Request it for your community
            </button>
          }
        />
      </motion.div>
    </motion.div>
  );
}
