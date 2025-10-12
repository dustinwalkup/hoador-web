import { UserCard } from "@/components/user-card";
import type { RentalUserInfo } from "@/dal/rentals.dal";

interface RentalUserInfoProps {
  rentalDetails: RentalUserInfo & { currentUserId: string };
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
        email: rentalDetails.ownerEmail,
        phone: rentalDetails.ownerPhone,
        profileImage: rentalDetails.ownerProfileImage,
        rating: rentalDetails.ownerRating,
        reviewCount: rentalDetails.ownerReviewCount,
        verified: rentalDetails.ownerVerified,
        memberSince: rentalDetails.ownerMemberSince,
      }
    : {
        id: rentalDetails.renterId,
        name: rentalDetails.renterName,
        email: rentalDetails.renterEmail,
        phone: rentalDetails.renterPhone,
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
      showContactInfo={true}
      recipientId={otherUser.id}
      recipientName={otherUser.name}
      listingId={rentalDetails.listingId}
      listingName={rentalDetails.listingName}
    />
  );
}
