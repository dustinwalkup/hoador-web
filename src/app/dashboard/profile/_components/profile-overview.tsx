import { Star, MapPin, Calendar } from "lucide-react";

import { reviewDAL } from "@/lib/dal";
import { UserProfile } from "@/lib/dal/types";
import { PROFILE_OVERVIEW } from "@/lib/constants/profile";
import { formatReviewSummary } from "@/lib/utils/reviews.utils";
import {
  formatMemberSince,
  getUserCity,
  getUserFullName,
  getUserInitials,
  getUserState,
} from "@/lib/utils/users.utils";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

import { ProfileForm } from "./profile-form";

export async function ProfileOverview({ user }: { user: UserProfile }) {
  const { averageRating, totalReviews } = await reviewDAL.getSummaryForUser(
    user.id,
  );

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <Card className="md:col-span-1">
        <CardHeader>
          <CardTitle>{PROFILE_OVERVIEW.profileCard.title}</CardTitle>
          <CardDescription>
            {PROFILE_OVERVIEW.profileCard.description}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center">
          <div className="relative mb-4">
            <Avatar className="h-32 w-32">
              <AvatarImage
                src={"/images/mock/testUser.jpg"}
                alt={`Avatar for ${getUserFullName(user)}`}
              />
              <AvatarFallback className="text-2xl">
                {getUserInitials(user)}
              </AvatarFallback>
            </Avatar>
          </div>

          <div className="mb-2 flex items-center">
            <h3 className="text-xl font-semibold">{getUserFullName(user)}</h3>
            <Badge variant="secondary" className="ml-2">
              {PROFILE_OVERVIEW.profileCard.verifiedBadge}
            </Badge>
          </div>

          <div className="text-muted-foreground mb-4 flex items-center text-sm">
            <MapPin className="mr-1 h-4 w-4" />
            <span>
              {getUserCity(user.primaryAddress)},{" "}
              {getUserState(user.primaryAddress)}
            </span>
          </div>

          <div className="mb-4 flex items-center">
            <div className="flex">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`h-4 w-4 ${star <= Math.round(averageRating) ? "fill-amber-400 text-amber-400" : "text-muted"}`}
                />
              ))}
            </div>
            <span className="ml-2 text-sm">
              {" "}
              {formatReviewSummary(averageRating, totalReviews)}
            </span>
          </div>

          <div className="text-muted-foreground mb-4 text-center text-sm">
            <div className="flex items-center">
              <Calendar className="mr-1 h-4 w-4" />
              <span>{formatMemberSince(user.createdAt)}</span>
            </div>
          </div>

          <Separator className="my-4" />

          <div className="grid w-full grid-cols-2 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold">32</div>
              <div className="text-muted-foreground text-xs">
                {PROFILE_OVERVIEW.profileCard.stats.borrowed.label}
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold">18</div>
              <div className="text-muted-foreground text-xs">
                {PROFILE_OVERVIEW.profileCard.stats.shared.label}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>{PROFILE_OVERVIEW.formCard.title}</CardTitle>
          <CardDescription>
            {PROFILE_OVERVIEW.formCard.description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm user={user} />
        </CardContent>
      </Card>
    </div>
  );
}
