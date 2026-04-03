import {
  Baby,
  Bell,
  Briefcase,
  Coins,
  HandHelping,
  Home,
  Leaf,
  MessageSquare,
  PartyPopper,
  PenToolIcon,
  PlusCircle,
  Truck,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  Baby,
  Bell,
  Briefcase,
  Coins,
  HandHelping,
  Home,
  Leaf,
  MessageSquare,
  PartyPopper,
  PenToolIcon,
  PlusCircle,
  Truck,
  Users,
  Wrench,
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
