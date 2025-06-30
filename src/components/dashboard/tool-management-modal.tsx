"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import {
  Settings,
  EyeOff,
  AlertTriangle,
  CheckCircle,
  Clock,
} from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const toolManagementSchema = z.object({
  status: z.enum(["available", "maintenance", "inactive"]),
});

type ToolManagementFormData = z.infer<typeof toolManagementSchema>;

interface ToolManagementModalProps {
  tool: {
    id: string;
    name: string;
    status: "available" | "rented" | "maintenance" | "inactive";
    isActive: boolean;
  };
  onSave: (data: ToolManagementFormData) => Promise<void>;
  trigger?: React.ReactNode;
}

export default function ToolManagementModal({
  tool,
  onSave,
  trigger,
}: ToolManagementModalProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<ToolManagementFormData>({
    resolver: zodResolver(toolManagementSchema),
    defaultValues: {
      status: tool.status === "rented" ? "available" : tool.status,
    },
  });

  const onSubmit = async (data: ToolManagementFormData) => {
    setIsLoading(true);
    try {
      await onSave(data);
      setOpen(false);
    } catch (error) {
      console.error("Failed to save tool:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case "available":
        return {
          icon: CheckCircle,
          color:
            "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
          description: "Tool is available for rental",
        };
      case "rented":
        return {
          icon: Clock,
          color:
            "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
          description: "Tool is currently rented out",
        };
      case "maintenance":
        return {
          icon: AlertTriangle,
          color:
            "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
          description: "Tool is under maintenance",
        };
      case "inactive":
        return {
          icon: EyeOff,
          color:
            "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300",
          description: "Tool is not available for rental",
        };
      default:
        return {
          icon: EyeOff,
          color:
            "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300",
          description: "Tool status unknown",
        };
    }
  };

  const currentStatus = form.watch("status");
  const statusInfo = getStatusInfo(currentStatus);
  const StatusIcon = statusInfo.icon;

  // If tool is currently rented, show a message instead of form
  if (tool.status === "rented") {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {trigger || <Button variant="outline">Manage</Button>}
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Manage Tool
            </DialogTitle>
            <DialogDescription>Tool status management</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border p-4">
              <div className="mb-3 flex items-center gap-3">
                <StatusIcon className="h-5 w-5" />
                <div>
                  <h3 className="font-medium">{tool.name}</h3>
                  <p className="text-muted-foreground text-sm">
                    {statusInfo.description}
                  </p>
                </div>
              </div>
              <Badge className={statusInfo.color}>
                {tool.status.charAt(0).toUpperCase() + tool.status.slice(1)}
              </Badge>
            </div>

            <p className="text-muted-foreground text-center text-sm">
              This tool is currently rented out. Status changes are not
              available while the tool is in use.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || <Button variant="outline">Manage</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Manage Tool
          </DialogTitle>
          <DialogDescription>Update tool status</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Current Status Display */}
            <div className="rounded-lg border p-4">
              <div className="mb-3 flex items-center gap-3">
                <StatusIcon className="h-5 w-5" />
                <div>
                  <h3 className="font-medium">{tool.name}</h3>
                  <p className="text-muted-foreground text-sm">
                    {statusInfo.description}
                  </p>
                </div>
              </div>
              <Badge className={statusInfo.color}>
                {currentStatus.charAt(0).toUpperCase() + currentStatus.slice(1)}
              </Badge>
            </div>

            {/* Status Management */}
            <div className="space-y-4">
              <h3 className="text-muted-foreground text-sm font-medium">
                Change Status
              </h3>

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="available">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            Available
                          </div>
                        </SelectItem>
                        <SelectItem value="maintenance">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-yellow-600" />
                            Maintenance
                          </div>
                        </SelectItem>
                        <SelectItem value="inactive">
                          <div className="flex items-center gap-2">
                            <EyeOff className="h-4 w-4 text-gray-600" />
                            Inactive
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
