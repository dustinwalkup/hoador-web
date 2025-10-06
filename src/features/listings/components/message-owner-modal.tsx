"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CheckCircle, Loader2, MessageCircle } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { startConversationAction } from "@/features/messages/actions/start-conversation";

interface MessageOwnerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipientId: string;
  recipientName: string;
  listingId: string;
  listingName: string;
}

type FormState = "idle" | "sending" | "success";

const validateMessage = (msg: string): string | null => {
  if (!msg.trim()) return "Message is required";
  if (msg.trim().length < 10) return "Message must be at least 10 characters";
  return null;
};

export function MessageOwnerModal({
  open,
  onOpenChange,
  recipientId,
  recipientName,
  listingId,
  listingName,
}: MessageOwnerModalProps) {
  const [isPending, startTransition] = useTransition();
  const [formState, setFormState] = useState<FormState>("idle");
  const [message, setMessage] = useState(
    `Hi, I'm interested in your ${listingName}`,
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const handleMessageChange = (value: string) => {
    setMessage(value);
    // Clear validation error when user starts typing after seeing an error
    if (validationError) {
      setValidationError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate message
    const error = validateMessage(message);
    if (error) {
      setValidationError(error);
      return;
    }

    // Clear errors
    setValidationError(null);
    setSubmitError(null);
    setFormState("sending");

    startTransition(async () => {
      const result = await startConversationAction(
        recipientId,
        listingId,
        listingName,
        message,
      );

      if (result.success && result.conversationId) {
        setConversationId(result.conversationId);
        setFormState("success");
      } else {
        setSubmitError(result.error || "Failed to send message");
        setFormState("idle");
      }
    });
  };

  const handleClose = () => {
    // Reset state when closing
    setFormState("idle");
    setMessage(`Hi, I'm interested in your ${listingName}`);
    setValidationError(null);
    setSubmitError(null);
    setConversationId(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        {formState === "success" ? (
          // Success State
          <div className="space-y-6 py-4 text-center">
            <div className="flex justify-center">
              <CheckCircle className="text-primary h-16 w-16" />
            </div>
            <div>
              <DialogTitle className="mb-2 text-xl">
                Message sent successfully!
              </DialogTitle>
              <DialogDescription>
                Your message has been sent to {recipientName}. They`&apos;ll
                receive a notification and can respond to you.
              </DialogDescription>
            </div>
            <div className="flex gap-3">
              <Button asChild className="flex-1">
                <Link
                  href={`/dashboard/mailbox?conversation=${conversationId}`}
                >
                  View Conversation
                </Link>
              </Button>
              <Button
                variant="outline"
                onClick={handleClose}
                className="flex-1"
              >
                Close
              </Button>
            </div>
          </div>
        ) : (
          // Form State
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center">
                <MessageCircle className="mr-2 h-5 w-5" />
                Message {recipientName}
              </DialogTitle>
              <DialogDescription>
                Send a message about {listingName}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              {submitError && (
                <Alert variant="destructive">
                  <AlertDescription>{submitError}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="message">Your Message</Label>
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => handleMessageChange(e.target.value)}
                  placeholder="Type your message here..."
                  rows={6}
                  disabled={formState === "sending"}
                  className={validationError ? "border-red-500" : ""}
                />
                {validationError && (
                  <p className="text-sm text-red-600">{validationError}</p>
                )}
              </div>

              <div className="flex gap-3">
                <Button
                  type="submit"
                  disabled={formState === "sending"}
                  className="flex-1"
                >
                  {formState === "sending" ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Send Message"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={formState === "sending"}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
