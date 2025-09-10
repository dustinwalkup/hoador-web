import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Activity {
  icon: ReactNode;
  title: string;
  description: string;
  timestamp: string;
  actionable?: boolean;
}

interface ActivityFeedProps {
  activities: Activity[];
}

export default function ActivityFeed({ activities }: ActivityFeedProps) {
  return (
    <div className="space-y-4">
      {activities.map((activity, index) => (
        <div key={index} className="flex items-start gap-3">
          <div
            className={cn(
              "mt-0.5 flex h-8 w-8 items-center justify-center rounded-full",
              activity.actionable
                ? "bg-amber-100 text-amber-600"
                : "bg-muted text-muted-foreground",
            )}
          >
            {activity.icon}
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-medium">{activity.title}</h4>
            <p className="text-muted-foreground text-xs">
              {activity.description}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              {activity.timestamp}
            </p>
          </div>
          {activity.actionable && (
            <Button size="sm" className="h-8 text-xs">
              Respond
            </Button>
          )}
        </div>
      ))}
      <div className="text-center">
        <Button variant="ghost" size="sm" className="text-xs">
          View All Activity
        </Button>
      </div>
    </div>
  );
}
