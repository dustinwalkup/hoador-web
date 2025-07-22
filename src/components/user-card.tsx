import Link from "next/link";
import { User, Star, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface UserCardProps {
  user: {
    id: string;
    name: string;
    profileImage?: string;
    rating?: number;
    reviewCount?: number;
    verified?: boolean;
    memberSince?: string;
    completedRentals?: number;
  };
  title: string;
  showActions?: boolean;
  showContactInfo?: boolean;
  className?: string;
}

export function UserCard({
  user,
  title,
  showActions = true,
  className = "",
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
              {user.verified && (
                <Badge
                  variant="secondary"
                  className="bg-blue-100 text-blue-800"
                >
                  <Shield className="mr-1 h-3 w-3" />
                  Verified
                </Badge>
              )}
            </div>
            {user.rating && (
              <div className="mb-2 flex items-center space-x-1">
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                <span className="text-sm text-gray-600">
                  {user.rating} ({user.reviewCount || 0} reviews)
                </span>
              </div>
            )}
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

        {showActions && (
          <div className="mt-4 space-y-2">
            <Link href={`/users/${user.id}`}>
              <Button variant="outline" className="w-full" size="sm">
                View Full Profile
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
