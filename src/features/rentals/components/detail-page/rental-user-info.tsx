import { UserCard } from "@/components/user-card";
import type { RentalUserInfo } from "@/dal/rentals.dal";

interface RentalUserInfoProps {
  // Contact fields are stripped before this page is rendered (PRIV-01).
  rentalDetails: Omit<
    RentalUserInfo,
    "renterEmail" | "renterPhone" | "ownerEmail" | "ownerPhone"
  > & { currentUserId: string };
  isRenter: boolean;
  isOwner: boolean;
}

export function RentalUserInfo({
  rentalDetails,
  isRenter,
}: RentalUserInfoProps) {
  const otherUser = isRenter
    ? {
        id: rentalDetails.ownerId,
        name: rentalDetails.ownerName,
        profileImage: rentalDetails.ownerProfileImage,
        rating: rentalDetails.ownerRating,
        reviewCount: rentalDetails.ownerReviewCount,
        verified: rentalDetails.ownerVerified,
        memberSince: rentalDetails.ownerMemberSince,
      }
    : {
        id: rentalDetails.renterId,
        name: rentalDetails.renterName,
        profileImage: rentalDetails.renterProfileImage,
        rating: rentalDetails.renterRating,
        reviewCount: rentalDetails.renterReviewCount,
        verified: rentalDetails.renterVerified,
        memberSince: rentalDetails.renterMemberSince,
        completedRentals: rentalDetails.renterCompletedRentals,
      };

  return (
    <UserCard
      user={otherUser}
      title={isRenter ? "Listing Owner" : "Renter"}
      showActions={true}
      recipientId={otherUser.id}
      recipientName={otherUser.name}
      listingId={rentalDetails.listingId}
      listingName={rentalDetails.listingName}
      existingConversationId={rentalDetails.conversationId}
    />
  );
}
