import Image from "next/image";
import Link from "next/link";
import {
  Calendar,
  MessageCircle,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Star,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { BorrowedTool } from "@/lib/dal/rentals.dal";

const getStatusIcon = (status: string) => {
  switch (status) {
    case "pending":
      return <Clock className="h-4 w-4 text-yellow-600" />;
    case "approved":
    case "active":
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    case "completed":
      return <CheckCircle className="h-4 w-4 text-blue-600" />;
    case "rejected":
    case "cancelled":
      return <XCircle className="h-4 w-4 text-red-600" />;
    default:
      return <AlertCircle className="h-4 w-4 text-gray-600" />;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case "pending":
      return "bg-yellow-100 text-yellow-800";
    case "approved":
    case "active":
      return "bg-green-100 text-green-800";
    case "completed":
      return "bg-blue-100 text-blue-800";
    case "rejected":
    case "cancelled":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

interface BorrowedToolCardProps {
  rental: BorrowedTool;
  currentTab: string;
}

export function BorrowedToolCard({
  rental,
  currentTab,
}: BorrowedToolCardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <Image
            src={rental.toolImageUrl || "/images/placeholder.jpg"}
            alt={rental.toolName}
            width={100}
            height={100}
            className="rounded-lg object-cover"
          />
          <div className="flex-1">
            <div className="mb-2 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold">{rental.toolName}</h3>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback>
                      {rental.ownerName
                        .split(" ")
                        .map((n: string) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  <span>by {rental.ownerName}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="mb-1 flex items-center gap-2">
                  {getStatusIcon(rental.status)}
                  <Badge className={getStatusColor(rental.status)}>
                    {rental.status}
                  </Badge>
                </div>
                <div className="text-lg font-semibold text-green-600">
                  ${parseFloat(rental.totalAmount).toFixed(2)}
                </div>
              </div>
            </div>

            <div className="mb-3 flex items-center gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>
                  {new Date(rental.startDate).toLocaleDateString()} to{" "}
                  {new Date(rental.endDate).toLocaleDateString()}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span>${parseFloat(rental.dailyRate).toFixed(2)}/day</span>
              </div>
            </div>

            <div className="flex gap-2">
              <Link href={`/dashboard/rental/${rental.id}?view=renting`}>
                <Button variant="outline" size="sm">
                  View Details
                </Button>
              </Link>
              <Link href={`/tools/${rental.toolId}`}>
                <Button variant="outline" size="sm">
                  View Tool
                </Button>
              </Link>
              <Button variant="outline" size="sm">
                <MessageCircle className="mr-1 h-4 w-4" />
                Message Owner
              </Button>
              {currentTab === "active" && (
                <>
                  <Button size="sm">Report Issue</Button>
                  <Button variant="outline" size="sm">
                    Request Extension
                  </Button>
                </>
              )}
              {currentTab === "completed" && (
                <>
                  <Button size="sm">
                    <Star className="mr-1 h-4 w-4" />
                    Leave Review
                  </Button>
                  <Link href={`/tools/${rental.toolId}/rent`}>
                    <Button variant="outline" size="sm">
                      Rent Again
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
