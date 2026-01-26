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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Users, Search } from "lucide-react";
import { PageHeader } from "@/components/page-header";

export const metadata = {
  title: "Admin - User Management",
  description: "Manage users and their accounts",
};

// Mock data - will be replaced with real data later
const mockUsers = [
  {
    id: 1,
    name: "John Doe",
    email: "john.doe@example.com",
    status: "active",
    userType: "standard",
    createdAt: "2024-01-15",
  },
  {
    id: 2,
    name: "Jane Smith",
    email: "jane.smith@example.com",
    status: "active",
    userType: "admin",
    createdAt: "2024-01-10",
  },
  {
    id: 3,
    name: "Bob Jones",
    email: "bob.jones@example.com",
    status: "suspended",
    userType: "standard",
    createdAt: "2023-12-20",
  },
  {
    id: 4,
    name: "Alice Brown",
    email: "alice.brown@example.com",
    status: "active",
    userType: "standard",
    createdAt: "2024-01-05",
  },
  {
    id: 5,
    name: "Charlie Wilson",
    email: "charlie.wilson@example.com",
    status: "inactive",
    userType: "standard",
    createdAt: "2023-11-30",
  },
];

export default function UserManagementPage() {
  return (
    <div className="page-container">
      <PageHeader
        title="User Management"
        description="Manage users and their accounts (Coming Soon)"
      />

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>
            View and manage user accounts. Full functionality coming soon.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 flex gap-4">
            <div className="relative flex-1">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                placeholder="Search users by name or email..."
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
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
            <Select disabled>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="standard">Standard</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="superadmin">Superadmin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Users Table */}
          <div className="space-y-2">
            {mockUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <div className="flex items-center gap-4">
                  <Users className="text-muted-foreground h-5 w-5" />
                  <div>
                    <h3 className="font-medium">{user.name}</h3>
                    <div className="text-muted-foreground flex items-center gap-2 text-sm">
                      <span>{user.email}</span>
                      <span>•</span>
                      <span>Joined: {user.createdAt}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge
                    variant={
                      user.status === "active"
                        ? "default"
                        : user.status === "suspended"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {user.status}
                  </Badge>
                  <Badge variant="outline">{user.userType}</Badge>
                  <Button variant="outline" size="sm" disabled>
                    View
                  </Button>
                  <Button variant="outline" size="sm" disabled>
                    Edit
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
