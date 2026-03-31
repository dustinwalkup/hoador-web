"use client";

import { MessageUserButton } from "@/features/messages/components/message-user-button";

export interface MessageUserActionProps {
  recipientId: string;
  recipientName: string;
  /** Tool rental listing id (`listings.id`). */
  listingId?: string;
  /** Service listing id (`service_listings.id`). */
  serviceListingId?: string;
  listingName: string;
  existingConversationId?: string | null;
  buttonText?: string;
  /** Applied to the outer wrapper (e.g. `mt-4` on rental UserCard). */
  className?: string;
}

/**
 * Shared layout for counterparty messaging: wraps MessageUserButton for
 * rental UserCard and service booking detail (same UX as rental detail).
 */
export function MessageUserAction({
  recipientId,
  recipientName,
  listingId,
  serviceListingId,
  listingName,
  existingConversationId,
  buttonText = "Message Owner",
  className,
}: MessageUserActionProps) {
  return (
    <div className={className}>
      <MessageUserButton
        recipientId={recipientId}
        recipientName={recipientName}
        listingId={listingId}
        serviceListingId={serviceListingId}
        listingName={listingName}
        existingConversationId={existingConversationId}
        buttonText={buttonText}
      />
    </div>
  );
}
