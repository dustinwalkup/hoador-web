import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Calendar,
  Clock,
  Coins,
  PlusCircle,
  Star,
  TrendingUp,
  Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonVariantsType } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DASHBOARD_PAGE } from "@/lib/constants/dashboard";
import { DASHBOARD } from "@/lib/constants/navbar";
import ActivityFeed from "@/components/dashboard/activity-feed";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import RentalCard from "@/components/dashboard/rental-card";

const { header, alerts, quickActions, pendingRequests } = DASHBOARD_PAGE;
const { user } = DASHBOARD;

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-2 text-2xl font-bold">
          {header.titleFor(user.firstName)}
        </h1>
        <p className="text-muted-foreground">{header.description}</p>
      </div>

      {/* Quick Actions section */}
      <Card className="border-primary/50 bg-background top-0 z-10 border-dashed">
        <CardContent className="px-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
              <PlusCircle className="text-primary h-4 w-4" />
              <span>{quickActions.title}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {quickActions.buttons.map((button) => {
                return (
                  <Button
                    size="sm"
                    key={button.id}
                    variant={button.buttonVariant as ButtonVariantsType}
                    className={`h-8 ${button.buttonVariant}`}
                  >
                    {button.icon}
                    {button.label}
                  </Button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alerts section */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="!gap-4 border-red-200 bg-red-50 dark:bg-red-950/10">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium text-red-700 dark:text-red-400">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  <span>{alerts.title}</span>
                </div>
              </CardTitle>
              <Badge
                variant="destructive"
                className="px-2 py-0 text-xs font-normal"
              >
                {alerts.items.length} {alerts.itemsLabel}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm">
              {alerts.items.map((item) => {
                return (
                  <li className="flex items-start gap-2" key={item.id}>
                    <div className="mt-0.5 h-2 w-2 rounded-full bg-red-500" />
                    <div>
                      <p className="font-medium text-red-700 dark:text-red-400">
                        {item.title}
                      </p>
                      <p className="text-xs text-red-600/80 dark:text-red-400/80">
                        {item.status} • {item.person}
                      </p>
                    </div>
                    {item.actionable && (
                      <Button
                        size="sm"
                        variant="destructive"
                        className="ml-auto h-7 text-xs"
                      >
                        {alerts.actionLabel}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        {/* Pending Requests & Approvals */}
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/10">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium text-amber-700 dark:text-amber-400">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  <span>{pendingRequests.title}</span>
                </div>
              </CardTitle>
              <Badge
                variant="secondary"
                className="bg-amber-100 px-2 py-0 text-xs font-normal text-amber-700"
              >
                {pendingRequests.items.length} {pendingRequests.requests}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm">
              {pendingRequests.items.slice(0, 2).map((item) => {
                return (
                  <li className="flex items-start gap-2" key={item.id}>
                    <div className="mt-0.5 h-2 w-2 rounded-full bg-amber-500" />
                    <div>
                      <p className="font-medium text-amber-700 dark:text-amber-400">
                        {item.title} {pendingRequests.from} {item.person}
                      </p>
                      <p className="text-xs text-amber-600/80 dark:text-amber-400/80">
                        {item.status} • {item.person}
                      </p>
                    </div>
                    <div className="ml-auto flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                      >
                        {pendingRequests.decline}
                      </Button>
                      <Button
                        size="sm"
                        className="h-7 bg-amber-600 text-xs hover:bg-amber-700"
                      >
                        {pendingRequests.accept}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
          {pendingRequests.items.length > 2 && (
            <CardFooter className="pt-0">
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto text-xs text-amber-700 hover:text-amber-800"
              >
                {pendingRequests.viewAllLabel}
                <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </CardFooter>
          )}
        </Card>
      </div>

      {/*  Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardContent className="px-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Active Rentals
                </p>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold">3</span>
                  <span className="text-muted-foreground text-sm">tools</span>
                </div>
              </div>
              <div
                className="h-2 w-2 rounded-full bg-amber-500"
                title="1 due soon"
              ></div>
            </div>
            <div className="mt-3 space-y-1">
              <p className="text-muted-foreground text-xs">
                Currently borrowing
              </p>
              <div className="flex items-center gap-1 text-xs text-amber-600">
                <span>1 due tomorrow</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="px-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Tools Lent
                </p>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold">2</span>
                  <span className="text-muted-foreground text-sm">tools</span>
                </div>
              </div>
              <div
                className="h-2 w-2 rounded-full bg-red-500"
                title="1 overdue"
              ></div>
            </div>
            <div className="mt-3 space-y-1">
              <p className="text-muted-foreground text-xs">Others borrowing</p>
              <div className="flex items-center gap-1 text-xs text-red-600">
                <span>1 overdue return</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="px-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Pending Requests
                </p>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold">4</span>
                  <span className="text-muted-foreground text-sm">
                    requests
                  </span>
                </div>
              </div>
              <div
                className="h-2 w-2 rounded-full bg-amber-500"
                title="Requests awaiting response"
              ></div>
            </div>
            <div className="mt-3 space-y-1">
              <p className="text-muted-foreground text-xs">Awaiting response</p>
              <div className="flex items-center gap-1 text-xs text-amber-600">
                <span>2 urgent (24h left)</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="px-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  This Month
                </p>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold">$87.50</span>
                </div>
              </div>
              <div className="flex items-center gap-1 text-xs text-green-600">
                <TrendingUp className="h-3 w-3" />
                <span>12%</span>
              </div>
            </div>
            <div className="mt-3 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Goal: $120</span>
                <span className="font-medium text-green-600">73%</span>
              </div>
              <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                <div className="h-full w-[73%] rounded-full bg-green-500 transition-all duration-500"></div>
              </div>
              <p className="text-muted-foreground text-xs">$32.50 to goal</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="px-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Reward Points
                </p>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold">350</span>
                  <span className="text-muted-foreground text-sm">pts</span>
                </div>
              </div>
              <div
                className="h-2 w-2 rounded-full bg-blue-500"
                title="Points available to redeem"
              ></div>
            </div>
            <div className="mt-3 space-y-1">
              <p className="text-muted-foreground text-xs">
                Next reward: 500 pts
              </p>
              <div className="flex items-center gap-1 text-xs text-blue-600">
                <Coins className="h-3 w-3" />
                <span>150 pts to $25 credit</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/*  Mini-Analytics */}
      <Card className="gap-2">
        <CardHeader className=" ">
          <CardTitle className="flex items-center gap-1 text-base">
            <BarChart3 className="h-5 w-5" />
            Activity Overview
          </CardTitle>
          <CardDescription>
            Your rental activity and earnings trends
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-3">
            <div>
              <h3 className="mb-2 text-sm font-medium">Rentals per Week</h3>
              <div className="bg-muted/50 h-32 rounded-md p-3">
                <div className="flex h-full items-end justify-between gap-1">
                  {[
                    { day: "M", count: 3, height: 30 },
                    { day: "T", count: 5, height: 50 },
                    { day: "W", count: 2, height: 20 },
                    { day: "T", count: 7, height: 70 },
                    { day: "F", count: 8, height: 80 },
                    { day: "S", count: 4, height: 40 },
                    { day: "S", count: 6, height: 60 },
                  ].map((item, i) => (
                    <div
                      key={i}
                      className="group flex h-full flex-1 flex-col items-center justify-end"
                    >
                      <div
                        className="bg-primary/80 group-hover:bg-primary relative min-h-[8px] w-full rounded-t-sm transition-all duration-300"
                        style={{ height: `${item.height}%` }}
                        title={`${item.day === "M" ? "Monday" : item.day === "T" && i === 1 ? "Tuesday" : item.day === "W" ? "Wednesday" : item.day === "T" && i === 3 ? "Thursday" : item.day === "F" ? "Friday" : item.day === "S" && i === 5 ? "Saturday" : "Sunday"}`}
                      >
                        <div className="bg-background absolute -top-6 left-1/2 -translate-x-1/2 rounded px-1 text-xs font-medium opacity-0 transition-opacity group-hover:opacity-100">
                          {item.count}
                        </div>
                      </div>
                      <div className="text-muted-foreground mt-2 text-xs font-medium">
                        {item.day}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-center">
                  <span className="text-muted-foreground text-xs">
                    This week: 35 total rentals
                  </span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-medium">Earnings Trend</h3>
              <div className="bg-muted/50 h-32 rounded-md p-2">
                <div className="relative h-full w-full">
                  <svg
                    className="h-full w-full"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                  >
                    <path
                      d="M0,50 L10,45 L20,60 L30,40 L40,45 L50,30 L60,35 L70,20 L80,30 L90,15 L100,25"
                      fill="none"
                      stroke="var(--primary)"
                      strokeWidth="2"
                    />
                    <path
                      d="M0,50 L10,45 L20,60 L30,40 L40,45 L50,30 L60,35 L70,20 L80,30 L90,15 L100,25 L100,100 L0,100 Z"
                      fill="var(--primary)"
                      fillOpacity="0.1"
                    />
                  </svg>
                  <div className="text-muted-foreground absolute right-0 bottom-0 left-0 flex justify-between text-xs">
                    <span>Apr</span>
                    <span>May</span>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-medium">Inventory Usage</h3>
              <div className="bg-muted/50 h-32 rounded-md p-4">
                <div className="flex h-full flex-col items-center justify-center">
                  <div className="relative h-24 w-24">
                    <svg className="h-full w-full" viewBox="0 0 100 100">
                      <circle
                        cx="50"
                        cy="50"
                        r="45"
                        fill="none"
                        stroke="var(--muted-foreground)"
                        strokeOpacity={0.2}
                        strokeWidth="10"
                      />
                      <circle
                        cx="50"
                        cy="50"
                        r="45"
                        fill="none"
                        stroke="var(--primary)"
                        strokeWidth="10"
                        strokeDasharray="283"
                        strokeDashoffset="85"
                        transform="rotate(-90 50 50)"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-2xl font-bold">70%</span>
                    </div>
                  </div>
                  <p className="text-muted-foreground mt-2 text-xs">
                    of your tools are active
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Recent Activity Feed */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>
              Latest updates on your rentals and listings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ActivityFeed
              activities={[
                {
                  icon: <Wrench className="h-4 w-4" />,
                  title: "Pressure Washer rented",
                  description: "You rented this from John D.",
                  timestamp: "2 hours ago",
                },
                {
                  icon: <Calendar className="h-4 w-4" />,
                  title: "Rental extension requested",
                  description: "Emily K. requested to extend Drill Set rental",
                  timestamp: "Yesterday",
                  actionable: true,
                },
                {
                  icon: <Star className="h-4 w-4" />,
                  title: "New review received",
                  description: "David P. gave you 5 stars",
                  timestamp: "2 days ago",
                },
                {
                  icon: <AlertCircle className="h-4 w-4" />,
                  title: "Return reminder",
                  description: "Circular Saw due in 3 days",
                  timestamp: "2 days ago",
                },
                {
                  icon: <Wrench className="h-4 w-4" />,
                  title: "Hedge Trimmer listed",
                  description: "You added a new tool to your listings",
                  timestamp: "3 days ago",
                },
              ]}
            />
            <div className="mt-4 text-center">
              <Button variant="outline" size="sm">
                View All Activity
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Schedule Widget */}
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Schedule</CardTitle>
            <CardDescription>
              Your rental timeline for the next 7 days
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="bg-primary/10 text-primary flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">May 25, 2023</p>
                  <p className="text-muted-foreground text-sm">
                    Return Pressure Washer to John D.
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <Button variant="outline" size="sm" className="h-7 text-xs">
                      Directions
                    </Button>
                    <Button size="sm" className="h-7 text-xs">
                      Request Extension
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="bg-primary/10 text-primary flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">May 26, 2023</p>
                  <p className="text-muted-foreground text-sm">
                    Emily K. returns Drill Set
                  </p>
                  <div className="mt-1">
                    <Button variant="outline" size="sm" className="h-7 text-xs">
                      Send Reminder
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="bg-primary/10 text-primary flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">May 28, 2023</p>
                  <p className="text-muted-foreground text-sm">
                    Return Circular Saw to Maria G.
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-4 text-center">
              <Button variant="outline" size="sm">
                View Full Calendar
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active tools */}
      <Tabs defaultValue="rentals" className="space-y-4">
        <TabsList>
          <TabsTrigger value="rentals">Your Rentals</TabsTrigger>
          <TabsTrigger value="lent">Tools Lent Out</TabsTrigger>
          <TabsTrigger value="listings">Your Listings</TabsTrigger>
        </TabsList>
        <TabsContent value="rentals" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <RentalCard
              name="Pressure Washer"
              owner="John D."
              imageUrl="/images/mock/pressure-washer.jpg"
              dueDate="May 25, 2023"
              status="active"
              price="$15/day"
            />
            <RentalCard
              name="Circular Saw"
              owner="Maria G."
              imageUrl="/images/mock/skill-saw.jpg"
              dueDate="May 28, 2023"
              status="active"
              price="$12/day"
            />
            <RentalCard
              name="Ladder (8ft)"
              owner="Robert T."
              imageUrl="/images/mock/ladder.jpg"
              dueDate="May 30, 2023"
              status="active"
              price="$6/day"
            />
          </div>
          <div className="text-center">
            <Button variant="outline" size="sm">
              View All Rentals
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </TabsContent>
        <TabsContent value="lent" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <RentalCard
              name="Drill Set"
              borrower="Emily K."
              imageUrl="/images/mock/drill-set.jpg"
              dueDate="May 26, 2023"
              status="lent"
              price="$10/day"
            />
            <RentalCard
              name="Lawn Mower"
              borrower="David P."
              imageUrl="/images/mock/lawn-mower.jpg"
              dueDate="June 2, 2023"
              status="lent"
              price="$20/day"
            />
          </div>
          <div className="text-center">
            <Button variant="outline" size="sm">
              View All Lent Tools
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </TabsContent>
        <TabsContent value="listings" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <RentalCard
              name="Drill Set"
              imageUrl="/images/mock/drill-set.jpg"
              status="listed"
              price="$10/day"
              availability="Available"
            />
            <RentalCard
              name="Lawn Mower"
              imageUrl="/images/mock/lawn-mower.jpg"
              status="listed"
              price="$20/day"
              availability="Currently Lent"
            />
            <RentalCard
              name="Hedge Trimmer"
              imageUrl="/images/mock/hedge-trimmer.jpg"
              status="listed"
              price="$15/day"
              availability="Available"
            />
          </div>
          <div className="text-center">
            <Button variant="outline" size="sm">
              View All Listings
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* 1.2. Review & Rating Snapshot (moved to bottom as requested) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
            Review & Rating Snapshot
          </CardTitle>
          <CardDescription>
            Your reputation in the Hoador community
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="flex flex-col items-center justify-center">
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
                Average rating
              </p>
              <Badge className="mt-2 bg-green-100 text-green-700">
                12 new this month
              </Badge>
            </div>

            <div className="space-y-2">
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
                <Progress value={75} className="h-2" />
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1">
                    <span>4</span>
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  </div>
                  <span className="text-muted-foreground text-xs">
                    8 reviews
                  </span>
                </div>
                <Progress value={20} className="h-2" />
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1">
                    <span>3</span>
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  </div>
                  <span className="text-muted-foreground text-xs">
                    2 reviews
                  </span>
                </div>
                <Progress value={5} className="h-2" />
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1">
                    <span>2</span>
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  </div>
                  <span className="text-muted-foreground text-xs">
                    0 reviews
                  </span>
                </div>
                <Progress value={0} className="h-2" />
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1">
                    <span>1</span>
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  </div>
                  <span className="text-muted-foreground text-xs">
                    0 reviews
                  </span>
                </div>
                <Progress value={0} className="h-2" />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <div className="mb-2">
                  <span className="text-sm font-medium">Recent Reviews</span>
                </div>
                <div className="bg-muted/30 rounded-lg border p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src="/avatar-anna.png" alt="Anna S." />
                      <AvatarFallback>AS</AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">Anna S.</span>
                    <div className="ml-auto flex">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className="h-3.5 w-3.5 fill-amber-400 text-amber-400"
                        />
                      ))}
                    </div>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    &quot;Great Drill Set! Everything was in perfect condition
                    and Steve was very helpful with instructions. &quot;
                  </p>
                </div>
              </div>
              <div className="bg-muted/30 rounded-lg border p-3">
                <div className="mb-2 flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src="/avatar-david.png" alt="David P." />
                    <AvatarFallback>DP</AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium">David P.</span>
                  <div className="ml-auto flex">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className="h-3.5 w-3.5 fill-amber-400 text-amber-400"
                      />
                    ))}
                  </div>
                </div>
                <p className="text-muted-foreground text-sm">
                  &quot;Steve is a reliable lender. The lawn mower was clean and
                  worked perfectly.&quot;
                </p>
              </div>
              <Button variant="outline" size="sm" className="w-full">
                View All Reviews
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
