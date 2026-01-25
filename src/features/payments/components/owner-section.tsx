"use client";

import {
  ConnectBalances,
  ConnectPayouts,
  ConnectPayments,
  ConnectDocuments,
} from "@stripe/react-connect-js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Owner section component displaying embedded Stripe Connect components
 * for managing earnings, payouts, payments, and documents
 */
export function OwnerSection() {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <ConnectBalances />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payouts</CardTitle>
          </CardHeader>
          <CardContent>
            <ConnectPayouts />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Payment History</CardTitle>
          </CardHeader>
          <CardContent>
            <ConnectPayments />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Tax Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <ConnectDocuments />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
