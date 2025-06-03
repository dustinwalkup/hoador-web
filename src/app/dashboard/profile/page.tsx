"use client";

import { useState } from "react";
import {
  Star,
  MapPin,
  Calendar,
  Edit,
  Camera,
  CheckCircle,
  AlertCircle,
  Shield,
  CreditCard,
  Download,
  Trash2,
  Eye,
  EyeOff,
  Smartphone,
  Globe,
  DollarSign,
  FileText,
  Lock,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { USER } from "@/lib/constants/navbar";

export default function ProfilePage() {
  const [editMode, setEditMode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState("profile");

  console.log(activeTab);
  return (
    <div className="container py-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Profile</h1>
          <p className="text-muted-foreground">
            Manage your personal information and preferences
          </p>
        </div>
        {activeTab === "profile" && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              onClick={() => setEditMode(!editMode)}
            >
              <Edit className="mr-2 h-4 w-4" />
              {editMode ? "Cancel" : "Edit Profile"}
            </Button>
            {editMode && (
              <Button size="sm" className="h-9">
                Save Changes
              </Button>
            )}
          </div>
        )}
      </div>

      <Tabs
        defaultValue="profile"
        className="space-y-6"
        onValueChange={setActiveTab}
      >
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="reviews">Reviews</TabsTrigger>
          <TabsTrigger value="verification">Verification</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="md:col-span-1">
              <CardHeader>
                <CardTitle>Profile Picture</CardTitle>
                <CardDescription>Your public profile image</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center">
                <div className="relative mb-4">
                  <Avatar className="h-32 w-32">
                    <AvatarImage
                      src={USER.avatar || "/avatar-steve.png"}
                      alt={USER.name}
                    />
                    <AvatarFallback className="text-2xl">
                      {USER.initials}
                    </AvatarFallback>
                  </Avatar>
                  {editMode && (
                    <Button
                      size="icon"
                      className="absolute right-0 bottom-0 h-8 w-8 rounded-full shadow-lg"
                      variant="secondary"
                    >
                      <Camera className="h-4 w-4" />
                      <span className="sr-only">Change profile picture</span>
                    </Button>
                  )}
                </div>

                <div className="mb-2 flex items-center">
                  <h3 className="text-xl font-semibold">{USER.name}</h3>
                  <Badge variant="secondary" className="ml-2">
                    Verified
                  </Badge>
                </div>

                <div className="text-muted-foreground mb-4 flex items-center text-sm">
                  <MapPin className="mr-1 h-4 w-4" />
                  <span>Oak Park, IL</span>
                </div>

                <div className="mb-4 flex items-center">
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`h-4 w-4 ${star <= 4 ? "fill-amber-400 text-amber-400" : "text-muted"}`}
                      />
                    ))}
                  </div>
                  <span className="ml-2 text-sm">4.8 (28 reviews)</span>
                </div>

                <div className="text-muted-foreground mb-4 text-center text-sm">
                  <div className="flex items-center">
                    <Calendar className="mr-1 h-4 w-4" />
                    <span>Member since May 2022</span>
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="grid w-full grid-cols-2 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold">32</div>
                    <div className="text-muted-foreground text-xs">
                      Tools Borrowed
                    </div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">18</div>
                    <div className="text-muted-foreground text-xs">
                      Tools Shared
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
                <CardDescription>Update your personal details</CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="first-name">First Name</Label>
                      {editMode ? (
                        <Input id="first-name" defaultValue="Steve" />
                      ) : (
                        <div className="rounded-md border px-3 py-2">Steve</div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="last-name">Last Name</Label>
                      {editMode ? (
                        <Input id="last-name" defaultValue="Miller" />
                      ) : (
                        <div className="rounded-md border px-3 py-2">
                          Miller
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    {editMode ? (
                      <Input
                        id="email"
                        type="email"
                        defaultValue="stevemiller@gmail.com"
                      />
                    ) : (
                      <div className="rounded-md border px-3 py-2">
                        stevemiller@gmail.com
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    {editMode ? (
                      <Input
                        id="phone"
                        type="tel"
                        defaultValue="(555) 123-4567"
                      />
                    ) : (
                      <div className="rounded-md border px-3 py-2">
                        (555) 123-4567
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address">Address</Label>
                    {editMode ? (
                      <Input id="address" defaultValue="123 Oak Street" />
                    ) : (
                      <div className="rounded-md border px-3 py-2">
                        123 Oak Street
                      </div>
                    )}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="city">City</Label>
                      {editMode ? (
                        <Input id="city" defaultValue="Oak Park" />
                      ) : (
                        <div className="rounded-md border px-3 py-2">
                          Oak Park
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="state">State</Label>
                      {editMode ? (
                        <Input id="state" defaultValue="IL" />
                      ) : (
                        <div className="rounded-md border px-3 py-2">IL</div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="zip">ZIP Code</Label>
                      {editMode ? (
                        <Input id="zip" defaultValue="60302" />
                      ) : (
                        <div className="rounded-md border px-3 py-2">60302</div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bio">Bio</Label>
                    {editMode ? (
                      <Textarea
                        id="bio"
                        defaultValue="DIY enthusiast and weekend woodworker. I love sharing my tools with neighbors and learning new skills."
                        rows={4}
                      />
                    ) : (
                      <div className="rounded-md border px-3 py-2">
                        DIY enthusiast and weekend woodworker. I love sharing my
                        tools with neighbors and learning new skills.
                      </div>
                    )}
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="reviews">
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
                      <span className="text-muted-foreground text-xs">
                        8 reviews
                      </span>
                    </div>
                    <Progress value={29} className="h-2" />
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
                    <Progress value={7} className="h-2" />
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
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Recent Reviews</CardTitle>
                <CardDescription>
                  What others are saying about you
                </CardDescription>
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
        </TabsContent>

        <TabsContent value="verification">
          <Card>
            <CardHeader>
              <CardTitle>Account Verification</CardTitle>
              <CardDescription>
                Verify your identity to build trust in the community
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-600">
                      <CheckCircle className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-medium">Email Verification</h3>
                      <p className="text-muted-foreground text-sm">
                        Your email address has been verified
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className="bg-green-50 text-green-600"
                  >
                    Verified
                  </Badge>
                </div>

                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-600">
                      <CheckCircle className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-medium">Phone Verification</h3>
                      <p className="text-muted-foreground text-sm">
                        Your phone number has been verified
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className="bg-green-50 text-green-600"
                  >
                    Verified
                  </Badge>
                </div>

                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                      <AlertCircle className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-medium">ID Verification</h3>
                      <p className="text-muted-foreground text-sm">
                        Upload a government-issued ID to verify your identity
                      </p>
                    </div>
                  </div>
                  <Button size="sm">Verify Now</Button>
                </div>

                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                      <AlertCircle className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-medium">Address Verification</h3>
                      <p className="text-muted-foreground text-sm">
                        Verify your address to build trust with lenders
                      </p>
                    </div>
                  </div>
                  <Button size="sm">Verify Now</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preferences">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>
                  Manage how you receive notifications
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Email Notifications</h3>
                    <p className="text-muted-foreground text-sm">
                      Receive updates about your rentals and messages
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">SMS Notifications</h3>
                    <p className="text-muted-foreground text-sm">
                      Receive text messages for important updates
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Push Notifications</h3>
                    <p className="text-muted-foreground text-sm">
                      Receive push notifications on your devices
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Marketing Communications</h3>
                    <p className="text-muted-foreground text-sm">
                      Receive promotional emails and updates
                    </p>
                  </div>
                  <Switch />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Tool Sharing Preferences</CardTitle>
                <CardDescription>
                  Configure your lending and borrowing settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="lending-radius">Lending Radius</Label>
                  <Select defaultValue="5">
                    <SelectTrigger>
                      <SelectValue placeholder="Select radius" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 mile</SelectItem>
                      <SelectItem value="3">3 miles</SelectItem>
                      <SelectItem value="5">5 miles</SelectItem>
                      <SelectItem value="10">10 miles</SelectItem>
                      <SelectItem value="20">20 miles</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Auto-approve Requests</h3>
                    <p className="text-muted-foreground text-sm">
                      Automatically approve rental requests from verified users
                    </p>
                  </div>
                  <Switch />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Weekend Availability</h3>
                    <p className="text-muted-foreground text-sm">
                      Allow tool pickups and returns on weekends
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="default-rental-period">
                    Default Rental Period
                  </Label>
                  <Select defaultValue="3">
                    <SelectTrigger>
                      <SelectValue placeholder="Select period" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 day</SelectItem>
                      <SelectItem value="3">3 days</SelectItem>
                      <SelectItem value="7">1 week</SelectItem>
                      <SelectItem value="14">2 weeks</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Privacy Settings</CardTitle>
                <CardDescription>
                  Control your profile visibility and data sharing
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Public Profile</h3>
                    <p className="text-muted-foreground text-sm">
                      Make your profile visible to other users
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Show Location</h3>
                    <p className="text-muted-foreground text-sm">
                      Display your general location to nearby users
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Show Activity Status</h3>
                    <p className="text-muted-foreground text-sm">
                      Let others see when you&apos;re active
                    </p>
                  </div>
                  <Switch />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Analytics Tracking</h3>
                    <p className="text-muted-foreground text-sm">
                      Help improve the platform with usage data
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Regional Settings</CardTitle>
                <CardDescription>
                  Configure language, timezone, and currency
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="language">Language</Label>
                  <Select defaultValue="en">
                    <SelectTrigger>
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="es">Español</SelectItem>
                      <SelectItem value="fr">Français</SelectItem>
                      <SelectItem value="de">Deutsch</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select defaultValue="america/chicago">
                    <SelectTrigger>
                      <SelectValue placeholder="Select timezone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="america/new_york">
                        Eastern Time
                      </SelectItem>
                      <SelectItem value="america/chicago">
                        Central Time
                      </SelectItem>
                      <SelectItem value="america/denver">
                        Mountain Time
                      </SelectItem>
                      <SelectItem value="america/los_angeles">
                        Pacific Time
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Select defaultValue="usd">
                    <SelectTrigger>
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="usd">USD ($)</SelectItem>
                      <SelectItem value="eur">EUR (€)</SelectItem>
                      <SelectItem value="gbp">GBP (£)</SelectItem>
                      <SelectItem value="cad">CAD (C$)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="security">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Password & Authentication</CardTitle>
                <CardDescription>
                  Manage your account security settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="current-password">Current Password</Label>
                  <div className="relative">
                    <Input
                      id="current-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter current password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute top-1/2 right-2 h-4 w-4 -translate-y-1/2"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    placeholder="Enter new password"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm New Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="Confirm new password"
                  />
                </div>

                <Button className="w-full">Update Password</Button>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Two-Factor Authentication</h3>
                    <p className="text-muted-foreground text-sm">
                      Add an extra layer of security to your account
                    </p>
                  </div>
                  <Button variant="outline" size="sm">
                    <Smartphone className="mr-2 h-4 w-4" />
                    Enable 2FA
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Login Activity</CardTitle>
                <CardDescription>
                  Recent login sessions and devices
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100">
                        <Globe className="h-4 w-4 text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium">Chrome on Windows</p>
                        <p className="text-muted-foreground text-sm">
                          Chicago, IL • Current session
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className="bg-green-50 text-green-600"
                    >
                      Active
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-3">
                      <div className="bg-muted flex h-8 w-8 items-center justify-center rounded-full">
                        <Smartphone className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium">iPhone Safari</p>
                        <p className="text-muted-foreground text-sm">
                          Chicago, IL • 2 hours ago
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm">
                      Revoke
                    </Button>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-3">
                      <div className="bg-muted flex h-8 w-8 items-center justify-center rounded-full">
                        <Globe className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium">Firefox on Mac</p>
                        <p className="text-muted-foreground text-sm">
                          Chicago, IL • Yesterday
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm">
                      Revoke
                    </Button>
                  </div>
                </div>

                <div className="mt-4">
                  <Button variant="outline" className="w-full">
                    <Shield className="mr-2 h-4 w-4" />
                    View Full Activity Log
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Account Actions</CardTitle>
                <CardDescription>
                  Manage your account data and settings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <Button
                    variant="outline"
                    className="h-auto flex-col gap-2 p-4"
                  >
                    <Download className="h-6 w-6" />
                    <div className="text-center">
                      <div className="font-medium">Export Data</div>
                      <div className="text-muted-foreground text-xs">
                        Download your account data
                      </div>
                    </div>
                  </Button>

                  <Button
                    variant="outline"
                    className="h-auto flex-col gap-2 p-4"
                  >
                    <Lock className="h-6 w-6" />
                    <div className="text-center">
                      <div className="font-medium">Deactivate Account</div>
                      <div className="text-muted-foreground text-xs">
                        Temporarily disable your account
                      </div>
                    </div>
                  </Button>

                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        className="h-auto flex-col gap-2 border-red-200 p-4 text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-6 w-6" />
                        <div className="text-center">
                          <div className="font-medium">Delete Account</div>
                          <div className="text-muted-foreground text-xs">
                            Permanently delete your account
                          </div>
                        </div>
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Delete Account</DialogTitle>
                        <DialogDescription>
                          This action cannot be undone. This will permanently
                          delete your account and remove all your data from our
                          servers.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="rounded-lg bg-red-50 p-4">
                          <h4 className="font-medium text-red-800">
                            Before you delete your account:
                          </h4>
                          <ul className="mt-2 text-sm text-red-700">
                            <li>• Complete any active rentals</li>
                            <li>• Withdraw any remaining balance</li>
                            <li>• Download your data if needed</li>
                          </ul>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="delete-confirmation">
                            Type &quot;DELETE&quot; to confirm
                          </Label>
                          <Input
                            id="delete-confirmation"
                            placeholder="DELETE"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline">Cancel</Button>
                        <Button variant="destructive">Delete Account</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="billing">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Payment Methods</CardTitle>
                <CardDescription>
                  Manage your payment and payout methods
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                      <CreditCard className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium">•••• •••• •••• 4242</p>
                      <p className="text-muted-foreground text-sm">
                        Expires 12/25 • Primary
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">
                    Edit
                  </Button>
                </div>

                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                      <DollarSign className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium">Bank Account ••••5678</p>
                      <p className="text-muted-foreground text-sm">
                        For payouts
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">
                    Edit
                  </Button>
                </div>

                <Button variant="outline" className="w-full">
                  <CreditCard className="mr-2 h-4 w-4" />
                  Add Payment Method
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Earnings & Payouts</CardTitle>
                <CardDescription>
                  Track your earnings and payout schedule
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-muted/50 rounded-lg p-3">
                    <div className="text-2xl font-bold">$87.50</div>
                    <div className="text-muted-foreground text-sm">
                      This month
                    </div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <div className="text-2xl font-bold">$245.00</div>
                    <div className="text-muted-foreground text-sm">
                      Available
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Payout Schedule</Label>
                  <Select defaultValue="weekly">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button className="w-full">Request Payout</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Transaction History</CardTitle>
                <CardDescription>Recent payments and earnings</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    {
                      type: "earning",
                      amount: "+$15.00",
                      description: "Pressure Washer rental",
                      date: "May 23",
                    },
                    {
                      type: "payment",
                      amount: "-$12.00",
                      description: "Circular Saw rental",
                      date: "May 22",
                    },
                    {
                      type: "earning",
                      amount: "+$10.00",
                      description: "Drill Set rental",
                      date: "May 20",
                    },
                    {
                      type: "payout",
                      amount: "-$180.00",
                      description: "Weekly payout",
                      date: "May 19",
                    },
                  ].map((transaction, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-full ${
                            transaction.type === "earning"
                              ? "bg-green-100"
                              : transaction.type === "payment"
                                ? "bg-red-100"
                                : "bg-blue-100"
                          }`}
                        >
                          {transaction.type === "earning" ? (
                            <DollarSign className="h-4 w-4 text-green-600" />
                          ) : transaction.type === "payment" ? (
                            <CreditCard className="h-4 w-4 text-red-600" />
                          ) : (
                            <Download className="h-4 w-4 text-blue-600" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium">
                            {transaction.description}
                          </p>
                          <p className="text-muted-foreground text-sm">
                            {transaction.date}
                          </p>
                        </div>
                      </div>
                      <div
                        className={`font-medium ${
                          transaction.type === "earning"
                            ? "text-green-600"
                            : transaction.type === "payment"
                              ? "text-red-600"
                              : "text-blue-600"
                        }`}
                      >
                        {transaction.amount}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4">
                  <Button variant="outline" className="w-full">
                    <FileText className="mr-2 h-4 w-4" />
                    View All Transactions
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Tax Information</CardTitle>
                <CardDescription>
                  Manage tax documents and settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Tax ID (SSN/EIN)</h3>
                    <p className="text-muted-foreground text-sm">
                      Required for tax reporting
                    </p>
                  </div>
                  <Button variant="outline" size="sm">
                    Add Tax ID
                  </Button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">2023 Tax Documents</h3>
                    <p className="text-muted-foreground text-sm">
                      1099 forms and summaries
                    </p>
                  </div>
                  <Button variant="outline" size="sm">
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </Button>
                </div>

                <div className="rounded-lg bg-amber-50 p-4">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-amber-600" />
                    <h4 className="font-medium text-amber-800">Tax Reminder</h4>
                  </div>
                  <p className="mt-1 text-sm text-amber-700">
                    You&apos;ve earned $1,245 this year. Tax documents will be
                    available in January.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
