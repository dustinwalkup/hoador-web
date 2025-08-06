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
        {/* Mobile Layout (Vertical) */}
        <div className="md:hidden">
          {/* Image Section */}
          <div className="relative mb-4 w-full">
            <Image
              src={rental.toolImageUrl || "/images/placeholder.jpg"}
              alt={rental.toolName}
              width={400}
              height={300}
              className="h-48 w-full rounded-lg object-cover"
            />
          </div>

          {/* Content Section */}
          <div>
            {/* Tool Information */}
            <div className="mb-4">
              <h3 className="mb-1 text-xl font-bold text-gray-900">
                {rental.toolName}
              </h3>
              <p className="mb-3 text-sm text-gray-600">
                by {rental.ownerName}
              </p>

              {/* Status and Price Row */}
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getStatusIcon(rental.status)}
                  <Badge className={getStatusColor(rental.status)}>
                    {rental.status}
                  </Badge>
                </div>
                <div className="text-xl font-bold text-green-600">
                  ${parseFloat(rental.totalAmount).toFixed(2)}
                </div>
              </div>

              {/* Date Range and Daily Rate */}
              <div className="mb-4 flex items-center gap-4 text-sm text-gray-700">
                <div className="flex items-center gap-2">
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
            </div>

            {/* Action Buttons - Vertical Stack */}
            <div className="space-y-3">
              <Link
                href={`/dashboard/rental/${rental.id}?view=renting`}
                className="block"
              >
                <Button variant="outline" className="w-full justify-center">
                  View Details
                </Button>
              </Link>

              <Link href={`/tools/${rental.toolId}`} className="block">
                <Button variant="outline" className="w-full justify-center">
                  View Tool
                </Button>
              </Link>

              <Button variant="outline" className="w-full justify-center">
                <MessageCircle className="mr-2 h-4 w-4" />
                Message Owner
              </Button>

              {currentTab === "active" && (
                <>
                  <Button className="w-full justify-center">
                    Report Issue
                  </Button>
                  <Button variant="outline" className="w-full justify-center">
                    Request Extension
                  </Button>
                </>
              )}

              {currentTab === "completed" && (
                <>
                  <Button className="w-full justify-center">
                    <Star className="mr-2 h-4 w-4" />
                    Leave Review
                  </Button>
                  <Link href={`/tools/${rental.toolId}/rent`} className="block">
                    <Button variant="outline" className="w-full justify-center">
                      Rent Again
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Desktop Layout (Horizontal) */}
        <div className="hidden items-start gap-4 md:flex">
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
