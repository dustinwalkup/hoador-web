import {
  Bell,
  Coins,
  Home,
  MessageSquare,
  PenToolIcon,
  PlusCircle,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  Bell,
  Coins,
  Home,
  MessageSquare,
  PenToolIcon,
  PlusCircle,
  Truck,
  Users,
};

interface IconProps {
  name: string;
  className?: string;
}

export function Icon({ name, className }: IconProps) {
  const IconComponent = iconMap[name];

  if (!IconComponent) {
    console.warn(`Icon "${name}" not found in icon map`);
    return null;
  }

  return <IconComponent className={className} />;
}

export { iconMap };
