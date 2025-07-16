import Link from "next/link";
import {
  Calendar,
  Clock,
  Star,
  User,
  Wrench,
  Truck,
  MessageCircle,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info,
  DollarSign,
} from "lucide-react";

import { BackButton } from "@/components/back-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import type { ToolDetails } from "@/lib/dal/types";

import { ImageCarousel } from "./image-carousel";
import { FavoritesButton } from "./favorites-button";

interface ToolDetailViewProps {
  tool: ToolDetails;
  isOwner: boolean;
}

export function ToolDetailView({ tool, isOwner }: ToolDetailViewProps) {
  const formatPrice = (amount: number) => `$${amount.toFixed(2)}`;
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getConditionColor = (condition: string) => {
    switch (condition.toLowerCase()) {
      case "excellent":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "good":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "fair":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
      case "poor":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "available":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "rented":
        return <Clock className="h-4 w-4 text-blue-600" />;
      case "maintenance":
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case "inactive":
        return <XCircle className="h-4 w-4 text-gray-600" />;
      default:
        return <XCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  return (
    <>
      <BackButton />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
        {/* Main Content */}
        <div className="space-y-6 lg:col-span-3">
          {/* Tool Images */}
          <ImageCarousel images={tool.images} toolName={tool.name} />

          {/* Tool Information */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-2xl">{tool.name}</CardTitle>
                  <div className="mt-2 flex items-center space-x-2">
                    <Badge variant="outline">{tool.category.name}</Badge>
                    <Badge
                      variant="secondary"
                      className={`capitalize ${getConditionColor(tool.condition)}`}
                    >
                      {tool.condition}
                    </Badge>
                    {getStatusIcon(tool.status)}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-700">{tool.description}</p>

              <div className="grid grid-cols-2 gap-4">
                {tool.brand && (
                  <div>
                    <h4 className="font-medium text-gray-900">Brand</h4>
                    <p className="text-gray-600">{tool.brand}</p>
                  </div>
                )}
                {tool.model && (
                  <div>
                    <h4 className="font-medium text-gray-900">Model</h4>
                    <p className="text-gray-600">{tool.model}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Specifications */}
          {Object.keys(tool.specifications).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Info className="mr-2 h-5 w-5" />
                  Specifications
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(tool.specifications).map(([key, value]) => (
                    <div key={key}>
                      <h4 className="font-medium text-gray-900">{key}</h4>
                      <p className="text-gray-600">{String(value)}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Usage Instructions */}
          {tool.instructions && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Wrench className="mr-2 h-5 w-5" />
                  Usage Instructions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700">{tool.instructions}</p>
              </CardContent>
            </Card>
          )}

          {/* Safety Notes */}
          {tool.safetyNotes && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-orange-600">
                  <AlertTriangle className="mr-2 h-5 w-5" />
                  Safety Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700">{tool.safetyNotes}</p>
              </CardContent>
            </Card>
          )}

          {/* Pickup & Delivery */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Truck className="mr-2 h-5 w-5" />
                Pickup & Delivery
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-700">Requires Pickup</span>
                <Badge variant={tool.requiresPickup ? "default" : "secondary"}>
                  {tool.requiresPickup ? "Yes" : "No"}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-700">Delivery Available</span>
                <Badge
                  variant={tool.deliveryAvailable ? "default" : "secondary"}
                >
                  {tool.deliveryAvailable ? "Yes" : "No"}
                </Badge>
              </div>
              {tool.deliveryAvailable && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700">Delivery Fee</span>
                    <span className="font-medium">
                      {formatPrice(tool.deliveryFee)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700">Delivery Radius</span>
                    <span className="font-medium">
                      {tool.deliveryRadius} miles
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6 lg:col-span-2">
          {/* Pricing */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <DollarSign className="mr-2 h-5 w-5" />
                Pricing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Daily Rate</span>
                  <span className="text-lg font-semibold">
                    {formatPrice(tool.dailyRate)}
                  </span>
                </div>
                {tool.weeklyRate && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Weekly Rate</span>
                    <span className="font-medium">
                      {formatPrice(tool.weeklyRate)}
                    </span>
                  </div>
                )}
                {tool.monthlyRate && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Monthly Rate</span>
                    <span className="font-medium">
                      {formatPrice(tool.monthlyRate)}
                    </span>
                  </div>
                )}
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-gray-600">Security Deposit</span>
                <span className="font-medium">
                  {formatPrice(tool.securityDeposit)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Rental Period */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Clock className="mr-2 h-5 w-5" />
                Rental Period
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Minimum</span>
                <span className="font-medium">
                  {tool.minimumRentalPeriod} day(s)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Maximum</span>
                <span className="font-medium">
                  {tool.maximumRentalPeriod} day(s)
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Owner Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <User className="mr-2 h-5 w-5" />
                Tool Owner
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={tool.owner.profileImageUrl} />
                  <AvatarFallback>
                    {tool.owner.firstName[0]}
                    {tool.owner.lastName[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h4 className="font-medium">
                    {tool.owner.firstName} {tool.owner.lastName}
                  </h4>
                  <div className="flex items-center space-x-1">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span className="text-sm text-gray-600">
                      {tool.owner.averageRating} ({tool.owner.reviewCount}{" "}
                      reviews)
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    Member since {formatDate(tool.owner.memberSince)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="space-y-3">
            {isOwner ? (
              <Button asChild className="w-full" size="lg">
                <Link href={`/dashboard/tools/${tool.id}/edit`}>Edit Tool</Link>
              </Button>
            ) : (
              <>
                <Button asChild className="w-full" size="lg">
                  <Link
                    className="flex items-center justify-center"
                    href={`/tools/${tool.id}/rent`}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    Rent Tool
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  className="w-full bg-transparent"
                  size="lg"
                >
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Message Owner
                </Button>
              </>
            )}
            <FavoritesButton
              toolId={tool.id}
              isFavorite={tool.isFavorited || false}
            />
          </div>

          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Listed</span>
                <span>{formatDate(tool.createdAt)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Views</span>
                <span>{tool.viewCount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Favorites</span>
                <span>{tool.favoriteCount}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
