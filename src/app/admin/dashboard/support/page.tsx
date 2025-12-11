import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { HelpCircle, Search } from "lucide-react";

// Mock data - will be replaced with real data later
const mockSupportTickets = [
  {
    id: 1,
    subject: "Account verification issue",
    user: "john.doe@example.com",
    status: "open",
    priority: "high",
    createdAt: "2024-01-20",
    updatedAt: "2 hours ago",
  },
  {
    id: 2,
    subject: "Payment refund request",
    user: "jane.smith@example.com",
    status: "in_progress",
    priority: "medium",
    createdAt: "2024-01-19",
    updatedAt: "5 hours ago",
  },
  {
    id: 3,
    subject: "Listing removal request",
    user: "bob.jones@example.com",
    status: "open",
    priority: "low",
    createdAt: "2024-01-18",
    updatedAt: "1 day ago",
  },
  {
    id: 4,
    subject: "Technical support needed",
    user: "alice.brown@example.com",
    status: "resolved",
    priority: "medium",
    createdAt: "2024-01-17",
    updatedAt: "2 days ago",
  },
  {
    id: 5,
    subject: "Feature request",
    user: "charlie.wilson@example.com",
    status: "open",
    priority: "low",
    createdAt: "2024-01-16",
    updatedAt: "3 days ago",
  },
];

export default function SupportItemsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Support Items</h1>
        <p className="text-muted-foreground mt-2">
          Manage support tickets and customer inquiries (Coming Soon)
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Support Tickets</CardTitle>
          <CardDescription>
            View and manage support tickets. Full functionality coming soon.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 flex gap-4">
            <div className="relative flex-1">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                placeholder="Search tickets..."
                className="pl-9"
                disabled
              />
            </div>
            <Select disabled>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
            <Select disabled>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tickets Table */}
          <div className="space-y-2">
            {mockSupportTickets.map((ticket) => (
              <div
                key={ticket.id}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <div className="flex items-center gap-4">
                  <HelpCircle className="text-muted-foreground h-5 w-5" />
                  <div>
                    <h3 className="font-medium">{ticket.subject}</h3>
                    <div className="text-muted-foreground flex items-center gap-2 text-sm">
                      <span>{ticket.user}</span>
                      <span>•</span>
                      <span>Created: {ticket.createdAt}</span>
                      <span>•</span>
                      <span>Updated: {ticket.updatedAt}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge
                    variant={
                      ticket.priority === "high"
                        ? "destructive"
                        : ticket.priority === "medium"
                          ? "default"
                          : "secondary"
                    }
                  >
                    {ticket.priority}
                  </Badge>
                  <Badge
                    variant={
                      ticket.status === "resolved"
                        ? "default"
                        : ticket.status === "in_progress"
                          ? "secondary"
                          : "outline"
                    }
                  >
                    {ticket.status}
                  </Badge>
                  <Button variant="outline" size="sm" disabled>
                    View
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
