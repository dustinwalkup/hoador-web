import { User, Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageOwnerButton } from "@/features/listings/components/message-owner-button";

interface UserCardProps {
  user: {
    id: string;
    name: string;
    profileImage?: string;
    rating?: number;
    reviewCount?: number;
    memberSince?: string;
    completedRentals?: number;
  };
  title: string;
  showActions?: boolean;
  showContactInfo?: boolean;
  className?: string;
  recipientId?: string;
  recipientName?: string;
  listingId?: string;
  listingName?: string;
  existingConversationId?: string | null;
}

export function UserCard({
  user,
  title,
  showActions = false,
  className = "",
  recipientId,
  recipientName,
  listingId,
  listingName,
  existingConversationId,
}: UserCardProps) {
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
    });
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center">
          <User className="mr-2 h-5 w-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center space-x-3">
          <Avatar className="h-12 w-12">
            <AvatarImage src={user.profileImage || "/images/placeholder.jpg"} />
            <AvatarFallback>
              {user.name
                .split(" ")
                .map((n) => n[0])
                .join("")}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="mb-1 flex items-center gap-2">
              <h4 className="font-medium">{user.name}</h4>
            </div>
            <div className="mb-2 flex items-center space-x-1">
              <Star
                className={`h-4 w-4 ${
                  user.rating && user.rating > 0
                    ? "fill-yellow-400 text-yellow-400"
                    : "text-gray-300"
                }`}
              />
              <span className="text-sm text-gray-600">
                {user.rating && user.rating > 0 ? user.rating : "0.0"} (
                {user.reviewCount || 0} reviews)
              </span>
            </div>
            <div className="space-y-1 text-xs text-gray-500">
              {user.memberSince && (
                <p>Member since {formatDate(user.memberSince)}</p>
              )}

              {user.completedRentals !== undefined && (
                <p>{user.completedRentals} completed rentals</p>
              )}
            </div>
          </div>
        </div>

        {showActions &&
          recipientId &&
          recipientName &&
          listingId &&
          listingName && (
            <div className="mt-4">
              <MessageOwnerButton
                recipientId={recipientId}
                recipientName={recipientName}
                listingId={listingId}
                listingName={listingName}
                existingConversationId={existingConversationId}
                buttonText={
                  title === "Renter" ? "Message Renter" : "Message Owner"
                }
              />
            </div>
          )}
      </CardContent>
    </Card>
  );
}
