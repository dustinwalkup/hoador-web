import { Card, CardContent } from "@/components/ui/card";
import { Shield, CheckCircle, MessageCircle } from "lucide-react";

export function RentalProtection() {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-2">
            <Shield className="mt-0.5 h-4 w-4 text-blue-600" />
            <div>
              <p className="font-medium">Protected Transaction</p>
              <p className="text-gray-600">
                Payment held securely until completion
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle className="mt-0.5 h-4 w-4 text-green-600" />
            <div>
              <p className="font-medium">Insurance Coverage</p>
              <p className="text-gray-600">Tool covered during rental period</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <MessageCircle className="mt-0.5 h-4 w-4 text-purple-600" />
            <div>
              <p className="font-medium">24/7 Support</p>
              <p className="text-gray-600">Help available anytime</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
