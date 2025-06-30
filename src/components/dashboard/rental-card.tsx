"use client";

import { toast } from "sonner";
import { Calendar, User } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { updateToolStatus } from "@/lib/actions/update-tool-status";

import ToolManagementModal from "./tool-management-modal";

interface RentalCardProps {
  name: string;
  id: string;
  imageUrl: string | null;
  price: string;
  status: "active" | "lent" | "listed";
  dueDate?: string;
  owner?: string;
  borrower?: string;
  availability?: string;
  toolData?: {
    id: string;
    name: string;
    status: "available" | "rented" | "maintenance" | "inactive";
    isActive: boolean;
  };
}

export default function RentalCard({
  name,
  id,
  imageUrl,
  price,
  status,
  dueDate,
  owner,
  borrower,
  availability,
  toolData,
}: RentalCardProps) {
  const handleToolUpdate = async (data: {
    status: "available" | "maintenance" | "inactive";
  }) => {
    const result = await updateToolStatus(id, data);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Tool status updated successfully");
    }
  };

  return (
    <Card className="overflow-hidden pt-0 pb-2">
      <div className="bg-muted aspect-[4/3] overflow-hidden">
        <Image
          src={imageUrl || "/images/placeholder.jpg"}
          alt={name}
          width={300}
          height={200}
          className="h-full w-full object-cover"
        />
      </div>
      <CardContent className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-medium">{name}</h3>
          <Badge
            variant={
              status === "active"
                ? "default"
                : status === "lent"
                  ? "secondary"
                  : "outline"
            }
            className="text-xs"
          >
            {status === "active"
              ? "Renting"
              : status === "lent"
                ? "Lent Out"
                : "Listed"}
          </Badge>
        </div>

        {(owner || borrower) && (
          <div className="text-muted-foreground mb-2 flex items-center gap-1 text-sm">
            <User className="h-3.5 w-3.5" />
            <span>{owner ? `From ${owner}` : `To ${borrower}`}</span>
          </div>
        )}

        {dueDate && (
          <div className="text-muted-foreground mb-2 flex items-center gap-1 text-sm">
            <Calendar className="h-3.5 w-3.5" />
            <span>Due {dueDate}</span>
          </div>
        )}

        {availability && (
          <div className="text-muted-foreground mb-2 text-sm">
            <span>Status: {availability}</span>
          </div>
        )}

        <div className="text-primary mb-3 font-medium">{price}</div>

        <div className="flex items-center gap-2">
          {status === "active" && (
            <>
              <Button asChild variant="outline" size="sm" className="flex-1">
                <Link href="#">Extend</Link>
              </Button>
              <Button size="sm" className="flex-1">
                Return
              </Button>
            </>
          )}

          {status === "lent" && (
            <>
              <Button asChild variant="outline" size="sm" className="flex-1">
                <Link href="#">Message</Link>
              </Button>
              <Button size="sm" className="flex-1">
                Mark Returned
              </Button>
            </>
          )}

          {status === "listed" && (
            <>
              <Button asChild variant="outline" size="sm" className="flex-1">
                <Link href={`/dashboard/tools/edit/${id}`}>Edit</Link>
              </Button>
              {toolData ? (
                <ToolManagementModal
                  tool={toolData}
                  onSave={handleToolUpdate}
                  trigger={
                    <Button size="sm" className="flex-1">
                      Manage
                    </Button>
                  }
                />
              ) : (
                <Button size="sm" className="flex-1">
                  Manage
                </Button>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
