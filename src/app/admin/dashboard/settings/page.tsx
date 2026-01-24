export const dynamic = "force-dynamic";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Settings } from "lucide-react";

export const metadata = {
  title: "Admin - Settings",
  description: "Configure system settings and preferences",
};

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Admin Settings</h1>
        <p className="text-muted-foreground mt-2">
          Configure system settings and preferences (Coming Soon)
        </p>
      </div>

      {/* System Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            System Settings
          </CardTitle>
          <CardDescription>
            Manage system-wide configuration. Changes coming soon.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="site-name">Site Name</Label>
            <Input id="site-name" defaultValue="Hoador" disabled />
          </div>

          <div className="space-y-2">
            <Label htmlFor="support-email">Support Email</Label>
            <Input
              id="support-email"
              type="email"
              defaultValue="support@hoador.com"
              disabled
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="maintenance-mode">Maintenance Mode</Label>
              <p className="text-muted-foreground text-sm">
                Enable maintenance mode to restrict site access
              </p>
            </div>
            <Switch id="maintenance-mode" disabled />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="registration-enabled">User Registration</Label>
              <p className="text-muted-foreground text-sm">
                Allow new users to register accounts
              </p>
            </div>
            <Switch id="registration-enabled" defaultChecked disabled />
          </div>

          <Button disabled>Save Changes</Button>
        </CardContent>
      </Card>

      {/* Email Templates */}
      <Card>
        <CardHeader>
          <CardTitle>Email Templates</CardTitle>
          <CardDescription>
            Manage email templates for system notifications. Coming soon.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground space-y-2 text-sm">
            <p>• Welcome Email Template</p>
            <p>• Password Reset Template</p>
            <p>• Support Ticket Notification Template</p>
            <p>• Account Suspension Template</p>
          </div>
          <Button className="mt-4" variant="outline" disabled>
            Manage Templates
          </Button>
        </CardContent>
      </Card>

      {/* Feature Flags */}
      <Card>
        <CardHeader>
          <CardTitle>Feature Flags</CardTitle>
          <CardDescription>
            Enable or disable platform features. Coming soon.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="feature-reviews">User Reviews</Label>
              <p className="text-muted-foreground text-sm">
                Allow users to leave reviews
              </p>
            </div>
            <Switch id="feature-reviews" defaultChecked disabled />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="feature-messaging">Messaging System</Label>
              <p className="text-muted-foreground text-sm">
                Enable user-to-user messaging
              </p>
            </div>
            <Switch id="feature-messaging" defaultChecked disabled />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="feature-payments">Payment Processing</Label>
              <p className="text-muted-foreground text-sm">
                Enable payment processing
              </p>
            </div>
            <Switch id="feature-payments" defaultChecked disabled />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
