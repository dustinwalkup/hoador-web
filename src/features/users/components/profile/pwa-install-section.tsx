/**
 * PWA Install Section Component
 *
 * Client component that displays manual install instructions.
 * This is used in the preferences page.
 */

"use client";

import { useState } from "react";
import {
  Smartphone,
  Check,
  Share2,
  Plus,
  Home,
  Download,
  MoreVertical,
  Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useInstallDirections } from "@/lib/pwa/use-install-directions";
import type { LucideIcon } from "lucide-react";

/**
 * Get icon component from icon name
 */
function getIconComponent(iconName: string): LucideIcon {
  const iconMap: Record<string, LucideIcon> = {
    Share2,
    Plus,
    Check,
    Home,
    Download,
    MoreVertical,
    Menu,
    Smartphone,
  };

  return iconMap[iconName] || Smartphone;
}

/**
 * PWA Install Section Component
 */
export function PWAInstallSection() {
  const { isInstalled, instructions } = useInstallDirections();
  const [isOpen, setIsOpen] = useState(false);

  // Don't show if already installed
  if (isInstalled) {
    return (
      <Alert>
        <Check className="h-5 w-5 text-green-600" />
        <AlertTitle>App Installed</AlertTitle>
        <AlertDescription>
          Hoador is installed on your device. You can access it from your home
          screen or app launcher.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {/* Manual install instructions */}
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="rounded-lg border p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <Smartphone className="text-primary mt-0.5 h-5 w-5" />
              <div className="flex-1">
                <h3 className="mb-1 font-medium">{instructions.title}</h3>
                <p className="text-muted-foreground text-sm">
                  Follow these steps to install Hoador on your device
                </p>
              </div>
            </div>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="shrink-0">
                {isOpen ? "Hide" : "Show"} Instructions
              </Button>
            </CollapsibleTrigger>
          </div>

          <CollapsibleContent className="mt-4 space-y-3">
            <div className="space-y-3">
              {instructions.steps.map((step, index) => {
                const IconComponent = getIconComponent(step.icon);
                return (
                  <div key={index} className="flex items-start gap-3">
                    <div className="bg-primary/10 text-primary mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
                      <IconComponent className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 text-sm leading-relaxed">
                      <span className="font-medium">{index + 1}.</span>{" "}
                      {step.text}
                    </div>
                  </div>
                );
              })}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </div>
  );
}
