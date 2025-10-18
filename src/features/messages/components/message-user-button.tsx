"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MessageUserModal } from "@/features/messages/components/message-user-modal";

interface MessageUserButtonProps {
  recipientId: string;
  recipientName: string;
  listingId: string;
  listingName: string;
  existingConversationId?: string | null;
  buttonText?: string;
}

export function MessageUserButton({
  recipientId,
  recipientName,
  listingId,
  listingName,
  existingConversationId,
  buttonText = "Message Owner",
}: MessageUserButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        className="w-full bg-transparent"
        size="lg"
        onClick={() => setIsModalOpen(true)}
      >
        <MessageCircle className="mr-2 h-4 w-4" />
        {buttonText}
      </Button>

      <MessageUserModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        recipientId={recipientId}
        recipientName={recipientName}
        listingId={listingId}
        listingName={listingName}
        existingConversationId={existingConversationId}
      />
    </>
  );
}
