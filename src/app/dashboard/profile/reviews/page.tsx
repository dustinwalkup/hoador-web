import Link from "next/link";
import { Star, ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/page-header";
import { PROFILE_TABS } from "@/constants/profile";
import { reviewDAL } from "@/dal";
import { getCurrentUserId } from "@/features/authentication/auth.utils";

import { ProfileTabs } from "../_components/profile-tabs";
import { ReviewsSortingControls } from "../_components/reviews-sorting-controls";
import { formatDistanceToNow } from "@/lib/utils/date.utils";

interface ReviewsPageProps {
  searchParams: Promise<{
    page?: string;
    limit?: string;
    sortBy?: string;
    sortOrder?: string;
  }>;
}

export default async function ReviewsPage({ searchParams }: ReviewsPageProps) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return (
      <div className="container py-6">
        <PageHeader
          title={PROFILE_TABS.title}
          description={PROFILE_TABS.description}
        />
        <ProfileTabs>
          <div className="grid gap-6">
            <Card>
              <CardContent className="pt-6">
                <div className="text-muted-foreground text-center">
                  <p>Please log in to view your reviews</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </ProfileTabs>
      </div>
    );
  }

  // Await searchParams to get the actual values
  const params = await searchParams;

  // Convert searchParams to plain object to avoid symbol properties
  const queryParams = {
    page: params?.page || "1",
    limit: params?.limit || "5",
    sortBy: params?.sortBy || "createdAt",
    sortOrder: params?.sortOrder || "desc",
  };

  // Parse query parameters
  const page = parseInt(queryParams.page);
  const limit = parseInt(queryParams.limit);
  const sortBy = queryParams.sortBy as "createdAt" | "rating";
  const sortOrder = queryParams.sortOrder as "asc" | "desc";
  const offset = (page - 1) * limit;

  // Fetch data with pagination and sorting
  const [summary, distribution, reviews, totalCount] = await Promise.all([
    reviewDAL.getSummaryForUser(userId),
    reviewDAL.getRatingDistribution(userId),
    reviewDAL.getRecentReviews(userId, {
      limit,
      offset,
      sortBy,
      sortOrder,
    }),
    reviewDAL.getReviewsCount(userId),
  ]);

  const totalPages = Math.ceil(totalCount / limit);

  return (
    <div className="container py-6">
      <PageHeader
        title={PROFILE_TABS.title}
        description={PROFILE_TABS.description}
      />

      <ProfileTabs>
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Rating Summary</CardTitle>
              <CardDescription>
                Your overall rating from the community
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold">
                    {summary.averageRating}
                  </span>
                  <span className="text-muted-foreground">/5</span>
                </div>
                <div className="mt-2 flex">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`h-5 w-5 ${
                        star <= Math.round(summary.averageRating)
                          ? "fill-amber-400 text-amber-400"
                          : "fill-amber-200 text-amber-200"
                      }`}
                    />
                  ))}
                </div>
                <p className="text-muted-foreground mt-2 text-sm">
                  Based on {summary.totalReviews} review
                  {summary.totalReviews !== 1 ? "s" : ""}
                </p>
              </div>

              <div className="mt-6 space-y-2">
                {distribution.map((item) => {
                  const percentage =
                    summary.totalReviews > 0
                      ? Math.round((item.count / summary.totalReviews) * 100)
                      : 0;

                  return (
                    <div key={item.rating}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <div className="flex items-center gap-1">
                          <span>{item.rating}</span>
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        </div>
                        <span className="text-muted-foreground text-xs">
                          {item.count} review{item.count !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <Progress value={percentage} className="h-2" />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Reviews</CardTitle>
                  <CardDescription>
                    What others are saying about you
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <ReviewsSortingControls
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {reviews.length === 0 ? (
                  <div className="text-muted-foreground py-8 text-center">
                    <p>No reviews yet</p>
                  </div>
                ) : (
                  reviews.map((review) => (
                    <div key={review.id} className="rounded-lg border p-4">
                      <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>
                              {review.reviewer?.name
                                ? review.reviewer.name
                                    .split(" ")
                                    .map((n) => n[0])
                                    .join("")
                                    .toUpperCase()
                                : "U"}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">
                              {review.reviewer?.name || "Anonymous"}
                            </div>
                            <div className="text-muted-foreground text-xs">
                              {formatDistanceToNow(new Date(review.createdAt), {
                                addSuffix: true,
                              })}
                            </div>
                          </div>
                        </div>
                        <div className="flex">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`h-4 w-4 ${
                                star <= review.rating
                                  ? "fill-amber-400 text-amber-400"
                                  : "fill-amber-200 text-amber-200"
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      {review.comment && (
                        <p className="text-sm">{review.comment}</p>
                      )}
                      {review.tool && (
                        <p className="text-muted-foreground mt-2 text-xs">
                          Tool: {review.tool.name}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-6 space-y-4">
                  <div className="text-muted-foreground text-center text-sm sm:text-left">
                    Showing {offset + 1} to{" "}
                    {Math.min(offset + limit, totalCount)} of {totalCount}{" "}
                    reviews
                  </div>

                  <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
                    {/* Page Numbers */}
                    <div className="flex items-center gap-1">
                      {Array.from(
                        { length: Math.min(5, totalPages) },
                        (_, i) => {
                          const pageNum = i + 1;
                          return (
                            <Link
                              key={pageNum}
                              href={{
                                pathname: "/dashboard/profile/reviews",
                                query: {
                                  ...queryParams,
                                  page: pageNum.toString(),
                                },
                              }}
                            >
                              <Button
                                variant={
                                  pageNum === page ? "default" : "outline"
                                }
                                size="sm"
                                className="min-w-[40px]"
                              >
                                {pageNum}
                              </Button>
                            </Link>
                          );
                        },
                      )}
                    </div>

                    {/* Navigation Buttons */}
                    <div className="flex items-center gap-2">
                      <Link
                        href={{
                          pathname: "/dashboard/profile/reviews",
                          query: {
                            ...queryParams,
                            page: Math.max(1, page - 1).toString(),
                          },
                        }}
                      >
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={page <= 1}
                          className="flex items-center gap-2"
                        >
                          <ChevronLeft className="h-4 w-4" />
                          <span className="hidden sm:inline">Previous</span>
                        </Button>
                      </Link>

                      <Link
                        href={{
                          pathname: "/dashboard/profile/reviews",
                          query: {
                            ...queryParams,
                            page: Math.min(totalPages, page + 1).toString(),
                          },
                        }}
                      >
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={page >= totalPages}
                          className="flex items-center gap-2"
                        >
                          <span className="hidden sm:inline">Next</span>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </ProfileTabs>
    </div>
  );
}
