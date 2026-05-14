"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  useAdminNetworks,
  useCreateCommunity,
  useUpdateCommunity,
  type CommunityFormValues,
} from "@/features/admin/hooks/use-admin-communities";
import type { Community } from "@/db/schemas/communities.schema";

const NO_NETWORK_VALUE = "__none__";

type FieldState = {
  name: string;
  imageUrl: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  latitude: string;
  longitude: string;
  isActive: boolean;
  networkId: string; // "" / NO_NETWORK_VALUE means standalone
};

function initialState(community?: Community | null): FieldState {
  return {
    name: community?.name ?? "",
    imageUrl: community?.imageUrl ?? "",
    address: community?.address ?? "",
    city: community?.city ?? "",
    state: community?.state ?? "",
    zip: community?.zip ?? "",
    latitude: community?.latitude ?? "",
    longitude: community?.longitude ?? "",
    isActive: community?.isActive ?? true,
    networkId: community?.networkId ?? "",
  };
}

const trimOrNull = (v: string): string | null => {
  const t = v.trim();
  return t.length === 0 ? null : t;
};

/**
 * Create / edit form for a community. Used inside the admin community CRUD UI.
 * When `community` is provided it edits; otherwise it creates.
 */
export function CommunityEditForm({
  community,
  onSaved,
  onCancel,
}: {
  community?: Community | null;
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const [fields, setFields] = useState<FieldState>(() =>
    initialState(community),
  );

  const { data: networks } = useAdminNetworks();
  const createMutation = useCreateCommunity();
  const updateMutation = useUpdateCommunity();
  const mutation = community ? updateMutation : createMutation;

  const set = <K extends keyof FieldState>(key: K, value: FieldState[K]) =>
    setFields((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (fields.name.trim().length === 0) return;

    const values: CommunityFormValues = {
      name: fields.name.trim(),
      imageUrl: trimOrNull(fields.imageUrl),
      address: trimOrNull(fields.address),
      city: trimOrNull(fields.city),
      state: trimOrNull(fields.state),
      zip: trimOrNull(fields.zip),
      latitude: trimOrNull(fields.latitude),
      longitude: trimOrNull(fields.longitude),
      isActive: fields.isActive,
      networkId:
        fields.networkId && fields.networkId !== NO_NETWORK_VALUE
          ? fields.networkId
          : null,
    };

    try {
      if (community) {
        await updateMutation.mutateAsync({ id: community.id, values });
      } else {
        await createMutation.mutateAsync(values);
      }
      onSaved?.();
    } catch {
      // Error surfaced via toast + alert below.
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {mutation.isError && (
        <Alert variant="destructive">
          <AlertDescription>
            {mutation.error instanceof Error
              ? mutation.error.message
              : "Failed to save community"}
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="community-name">Name</Label>
        <Input
          id="community-name"
          value={fields.name}
          onChange={(e) => set("name", e.target.value)}
          required
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="community-address">Address</Label>
          <Input
            id="community-address"
            value={fields.address}
            onChange={(e) => set("address", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="community-city">City</Label>
          <Input
            id="community-city"
            value={fields.city}
            onChange={(e) => set("city", e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="community-state">State</Label>
            <Input
              id="community-state"
              value={fields.state}
              onChange={(e) => set("state", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="community-zip">ZIP</Label>
            <Input
              id="community-zip"
              value={fields.zip}
              onChange={(e) => set("zip", e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="community-lat">Latitude</Label>
          <Input
            id="community-lat"
            value={fields.latitude}
            onChange={(e) => set("latitude", e.target.value)}
            placeholder="e.g. 38.9822"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="community-lng">Longitude</Label>
          <Input
            id="community-lng"
            value={fields.longitude}
            onChange={(e) => set("longitude", e.target.value)}
            placeholder="e.g. -94.6708"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="community-image">Image URL</Label>
          <Input
            id="community-image"
            value={fields.imageUrl}
            onChange={(e) => set("imageUrl", e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="community-network">Network</Label>
        <Select
          value={fields.networkId || NO_NETWORK_VALUE}
          onValueChange={(v) => set("networkId", v)}
        >
          <SelectTrigger id="community-network" className="w-full">
            <SelectValue placeholder="No network (standalone)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_NETWORK_VALUE}>
              No network (standalone)
            </SelectItem>
            {(networks ?? []).map((network) => (
              <SelectItem key={network.id} value={network.id}>
                {network.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <Label htmlFor="community-active">Active</Label>
          <p className="text-muted-foreground text-xs">
            Inactive communities are hidden from new signups and search.
          </p>
        </div>
        <Switch
          id="community-active"
          checked={fields.isActive}
          onCheckedChange={(v) => set("isActive", v)}
          aria-label="Community active"
        />
      </div>

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          disabled={fields.name.trim().length === 0 || mutation.isPending}
        >
          {mutation.isPending
            ? "Saving…"
            : community
              ? "Save changes"
              : "Create community"}
        </Button>
      </div>
    </form>
  );
}
