"use client";

import { useState } from "react";
import { Edit3 } from "lucide-react";

import { PROFILE_OVERVIEW, US_STATES } from "@/constants/profile";
import { UserProfile } from "@/dal/types";
import { useProfile } from "@/features/users/hooks/use-profile";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EditProfileDialog } from "./edit-profile-dialog";

const formatPhoneDisplay = (phone?: string | null) => {
  if (!phone) return "Not provided";
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
};

const stateDisplay = (stateValue?: string | null) => {
  if (!stateValue) return "Not provided";
  return US_STATES.find((s) => s.value === stateValue)?.label ?? stateValue;
};

function ReadOnlyField({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div className="space-y-1">
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {label}
      </p>
      <p className={multiline ? "text-sm whitespace-pre-wrap" : "text-sm"}>
        {value}
      </p>
    </div>
  );
}

export function ProfileForm({ user: initialUser }: { user: UserProfile }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: user } = useProfile(initialUser);

  const { fields } = PROFILE_OVERVIEW.formCard;

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div className="space-y-1.5">
            <CardTitle>{PROFILE_OVERVIEW.formCard.title}</CardTitle>
            <CardDescription>
              {PROFILE_OVERVIEW.formCard.description}
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setDialogOpen(true)}
            aria-label="Edit profile"
            data-testid="edit-profile-button"
          >
            <Edit3 className="mr-2 h-4 w-4" />
            Edit
          </Button>
        </CardHeader>

        <CardContent>
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <ReadOnlyField
                label={fields.firstName}
                value={user.firstName || "Not provided"}
              />
              <ReadOnlyField
                label={fields.lastName}
                value={user.lastName || "Not provided"}
              />
              <ReadOnlyField label={fields.email} value={user.email} />
              <ReadOnlyField
                label={fields.phone}
                value={formatPhoneDisplay(user.phone)}
              />
            </div>

            <ReadOnlyField
              label={fields.bio}
              value={user.bio || "No bio provided"}
              multiline
            />

            <div className="space-y-4 border-t pt-4">
              <h3 className="text-base font-medium">Address Information</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <ReadOnlyField
                  label={fields.street}
                  value={user.primaryAddress?.street || "Not provided"}
                />
                <ReadOnlyField
                  label={fields.city}
                  value={user.primaryAddress?.city || "Not provided"}
                />
                <ReadOnlyField
                  label={fields.state}
                  value={stateDisplay(user.primaryAddress?.state)}
                />
                <ReadOnlyField
                  label={fields.zipCode}
                  value={user.primaryAddress?.zipCode || "Not provided"}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <EditProfileDialog
        user={user}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
}
