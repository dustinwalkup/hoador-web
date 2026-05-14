"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RequestHoadorModal } from "@/features/hoa-inquiries/components/request-hoador-modal";
import { useCommunitiesByNetwork } from "@/features/community/hooks/use-communities";
import { SESSION_EXPIRED_MESSAGE } from "../constants";
import { useSelectCommunity } from "../hooks/use-auth-mutations";
import { containerVariants, fieldVariants } from "./animated-form-field";

export function CommunitySelectForm() {
  const router = useRouter();
  const [communityId, setCommunityId] = useState<string>("");

  const { data: communities, isLoading, isError } = useCommunitiesByNetwork();
  const mutation = useSelectCommunity();

  useEffect(() => {
    if (
      mutation.isError &&
      mutation.error instanceof Error &&
      mutation.error.message === SESSION_EXPIRED_MESSAGE
    ) {
      router.replace("/login?callbackUrl=/community-select");
    }
  }, [mutation.isError, mutation.error, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!communityId) return;
    try {
      await mutation.mutateAsync({ communityId });
    } catch {
      // Error surfaced via the mutation hook (toast + alert below).
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
        {mutation.isError && (
          <Alert variant="destructive">
            <AlertDescription>
              {mutation.error instanceof Error
                ? mutation.error.message
                : "Failed to select community"}
            </AlertDescription>
          </Alert>
        )}

        {isError && (
          <Alert variant="destructive">
            <AlertDescription>
              We couldn&apos;t load the list of communities. Please refresh and
              try again.
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <motion.div variants={fieldVariants} className="space-y-2">
            <Label htmlFor="community">Select your community</Label>
            <Select
              value={communityId}
              onValueChange={setCommunityId}
              disabled={isLoading || mutation.isPending}
            >
              <SelectTrigger id="community" className="w-full">
                <SelectValue
                  placeholder={
                    isLoading ? "Loading communities…" : "Choose your community"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {(communities ?? []).map((community) => {
                  const location = [community.city, community.state]
                    .filter(Boolean)
                    .join(", ");
                  return (
                    <SelectItem key={community.id} value={community.id}>
                      <span>{community.name}</span>
                      {location && (
                        <span className="text-muted-foreground ml-2 text-xs font-normal italic">
                          {location}
                        </span>
                      )}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </motion.div>

          <motion.div variants={fieldVariants}>
            <Button
              type="submit"
              className="w-full"
              disabled={!communityId || mutation.isPending}
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </motion.div>
        </form>
      </div>

      <motion.div
        variants={fieldVariants}
        className="text-muted-foreground space-y-2 text-center text-xs"
      >
        <p>
          Don&apos;t see yours?{" "}
          <RequestHoadorModal
            trigger={
              <button
                type="button"
                className="text-primary hover:text-primary/80 underline underline-offset-2"
              >
                Request your community
              </button>
            }
          />
        </p>
        <p>
          Have a private invite code?{" "}
          <Link
            href="/join-code"
            className="text-primary hover:text-primary/80 underline underline-offset-2"
          >
            Enter it here
          </Link>
        </p>
      </motion.div>
    </motion.div>
  );
}
