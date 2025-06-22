import { Star } from "lucide-react";
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

export function ReviewsTab() {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      <Card className="md:col-span-1">
        <CardHeader>
          <CardTitle>Rating Summary</CardTitle>
          <CardDescription>
            Your overall rating from the community
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center">
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold">4.8</span>
              <span className="text-muted-foreground">/5</span>
            </div>
            <div className="mt-2 flex">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`h-5 w-5 ${
                    star <= 4
                      ? "fill-amber-400 text-amber-400"
                      : "fill-amber-200 text-amber-200"
                  }`}
                />
              ))}
            </div>
            <p className="text-muted-foreground mt-2 text-sm">
              Based on 28 reviews
            </p>
          </div>

          <div className="mt-6 space-y-2">
            <div>
              <div className="mb-1 flex items-center justify-between text-sm">
                <div className="flex items-center gap-1">
                  <span>5</span>
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                </div>
                <span className="text-muted-foreground text-xs">
                  18 reviews
                </span>
              </div>
              <Progress value={64} className="h-2" />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-sm">
                <div className="flex items-center gap-1">
                  <span>4</span>
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                </div>
                <span className="text-muted-foreground text-xs">8 reviews</span>
              </div>
              <Progress value={29} className="h-2" />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-sm">
                <div className="flex items-center gap-1">
                  <span>3</span>
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                </div>
                <span className="text-muted-foreground text-xs">2 reviews</span>
              </div>
              <Progress value={7} className="h-2" />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-sm">
                <div className="flex items-center gap-1">
                  <span>2</span>
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                </div>
                <span className="text-muted-foreground text-xs">0 reviews</span>
              </div>
              <Progress value={0} className="h-2" />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-sm">
                <div className="flex items-center gap-1">
                  <span>1</span>
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                </div>
                <span className="text-muted-foreground text-xs">0 reviews</span>
              </div>
              <Progress value={0} className="h-2" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Recent Reviews</CardTitle>
          <CardDescription>What others are saying about you</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {[1, 2, 3].map((review) => (
              <div key={review} className="rounded-lg border p-4">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>
                        {review === 1 ? "AS" : review === 2 ? "DP" : "MG"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">
                        {review === 1
                          ? "Anna S."
                          : review === 2
                            ? "David P."
                            : "Maria G."}
                      </div>
                      <div className="text-muted-foreground text-xs">
                        {review === 1
                          ? "May 15, 2023"
                          : review === 2
                            ? "April 28, 2023"
                            : "April 10, 2023"}
                      </div>
                    </div>
                  </div>
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`h-4 w-4 ${
                          star <= (review === 3 ? 4 : 5)
                            ? "fill-amber-400 text-amber-400"
                            : "fill-amber-200 text-amber-200"
                        }`}
                      />
                    ))}
                  </div>
                </div>
                <p className="text-sm">
                  {review === 1
                    ? "Great experience borrowing the drill set! Everything was in perfect condition and Steve was very helpful with instructions."
                    : review === 2
                      ? "Steve is a reliable lender. The lawn mower was clean and worked perfectly. Would definitely borrow from him again."
                      : "The circular saw was in good condition, but the blade was a bit dull. Otherwise, Steve was prompt and communicative."}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-4 text-center">
            <Button variant="outline">View All Reviews</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
