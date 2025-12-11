import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Edit } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// Mock data - will be replaced with real data later
const mockLegalDocuments = [
  {
    id: 1,
    name: "Terms of Service",
    lastUpdated: "2024-01-15",
    status: "published",
    version: "2.1",
  },
  {
    id: 2,
    name: "Privacy Policy",
    lastUpdated: "2024-01-10",
    status: "published",
    version: "3.0",
  },
  {
    id: 3,
    name: "Community Guidelines",
    lastUpdated: "2023-12-20",
    status: "published",
    version: "1.5",
  },
  {
    id: 4,
    name: "Cancellation and Refund Policy",
    lastUpdated: "2024-01-05",
    status: "published",
    version: "1.2",
  },
  {
    id: 5,
    name: "Damage, Lost and Liability Policy",
    lastUpdated: "2023-11-30",
    status: "draft",
    version: "2.0",
  },
];

export default function LegalDocumentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Legal Documents</h1>
        <p className="text-muted-foreground mt-2">
          Manage legal documents and policies (Coming Soon)
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Document Library</CardTitle>
          <CardDescription>
            View and edit legal documents. Editing functionality coming soon.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {mockLegalDocuments.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <div className="flex items-center gap-4">
                  <FileText className="text-muted-foreground h-5 w-5" />
                  <div>
                    <h3 className="font-medium">{doc.name}</h3>
                    <div className="text-muted-foreground flex items-center gap-2 text-sm">
                      <span>Last updated: {doc.lastUpdated}</span>
                      <span>•</span>
                      <span>Version {doc.version}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge
                    variant={
                      doc.status === "published" ? "default" : "secondary"
                    }
                  >
                    {doc.status}
                  </Badge>
                  <Button variant="outline" size="sm" disabled>
                    <Edit className="mr-2 h-4 w-4" />
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
