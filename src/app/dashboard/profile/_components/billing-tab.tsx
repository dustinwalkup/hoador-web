"use client";
import {
  AlertCircle,
  CreditCard,
  Download,
  DollarSign,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function BillingTab() {
  return (
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
                <p className="text-muted-foreground text-sm">For payouts</p>
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
              <div className="text-muted-foreground text-sm">This month</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="text-2xl font-bold">$245.00</div>
              <div className="text-muted-foreground text-sm">Available</div>
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
                    <p className="font-medium">{transaction.description}</p>
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
          <CardDescription>Manage tax documents and settings</CardDescription>
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
  );
}
