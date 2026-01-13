import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PWAInstallSection } from "./pwa-install-section";

export function PreferencesTab() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>App Installation</CardTitle>
          <CardDescription>
            Install Hoador as an app on your device for quick access
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PWAInstallSection />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Notification Preferences</CardTitle>
          <CardDescription>
            Manage how you receive notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-medium">Email Notifications</h3>
              <p className="text-muted-foreground text-sm">
                Receive updates about your rentals and messages
              </p>
            </div>
            <Switch defaultChecked />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-medium">SMS Notifications</h3>
              <p className="text-muted-foreground text-sm">
                Receive text messages for important updates
              </p>
            </div>
            <Switch defaultChecked />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-medium">Push Notifications</h3>
              <p className="text-muted-foreground text-sm">
                Receive push notifications on your devices
              </p>
            </div>
            <Switch defaultChecked />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-medium">Auto-approve Requests</h3>
              <p className="text-muted-foreground text-sm">
                Automatically approve rental requests from verified users
              </p>
            </div>
            <Switch />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-medium">Weekend Availability</h3>
              <p className="text-muted-foreground text-sm">
                Allow tool pickups and returns on weekends
              </p>
            </div>
            <Switch defaultChecked />
          </div>

          <div className="space-y-2">
            <Label htmlFor="default-rental-period">Default Rental Period</Label>
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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-medium">Public Profile</h3>
              <p className="text-muted-foreground text-sm">
                Make your profile visible to other users
              </p>
            </div>
            <Switch defaultChecked />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-medium">Show Location</h3>
              <p className="text-muted-foreground text-sm">
                Display your general location to nearby users
              </p>
            </div>
            <Switch defaultChecked />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-medium">Show Activity Status</h3>
              <p className="text-muted-foreground text-sm">
                Let others see when you&apos;re active
              </p>
            </div>
            <Switch />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
                <SelectItem value="america/new_york">Eastern Time</SelectItem>
                <SelectItem value="america/chicago">Central Time</SelectItem>
                <SelectItem value="america/denver">Mountain Time</SelectItem>
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
  );
}
