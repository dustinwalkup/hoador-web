"use client";
import { useState } from "react";
import {
  Shield,
  Download,
  Trash2,
  Eye,
  EyeOff,
  Smartphone,
  Globe,
  Lock,
} from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function SecurityTab() {
  const [showPassword, setShowPassword] = useState(false);

  return (
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
          <CardDescription>Recent login sessions and devices</CardDescription>
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
              <Badge variant="outline" className="bg-green-50 text-green-600">
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
            <Button variant="outline" className="h-auto flex-col gap-2 p-4">
              <Download className="h-6 w-6" />
              <div className="text-center">
                <div className="font-medium">Export Data</div>
                <div className="text-muted-foreground text-xs">
                  Download your account data
                </div>
              </div>
            </Button>

            <Button variant="outline" className="h-auto flex-col gap-2 p-4">
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
                    This action cannot be undone. This will permanently delete
                    your account and remove all your data from our servers.
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
                    <Input id="delete-confirmation" placeholder="DELETE" />
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
  );
}
