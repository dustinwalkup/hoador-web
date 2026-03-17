import type { FunctionComponent, SVGProps } from "react";
import {
  WarehouseIcon,
  // HeartIcon,
  UserIcon,
  MailIcon,
  HomeIcon,
  BookOpenIcon,
  CreditCardIcon,
  FileSignatureIcon,
  HelpCircleIcon,
  SearchIcon,
  SettingsIcon,
  CalendarIcon,
  DollarSign,
} from "lucide-react";
import DoorIcon from "@/components/ui/door-icon";

export type IconComponent = FunctionComponent<SVGProps<SVGSVGElement>>;

export interface SubNavItem {
  readonly title: string;
  readonly url: string;
}

export interface MainNavItem {
  readonly title: string;
  readonly url?: string; // Optional for parent items with children
  readonly icon: IconComponent;
  readonly items?: {
    readonly label: string;
    readonly items: readonly SubNavItem[];
  }[]; // Support grouped sub-items
}

export const MAIN_NAV: MainNavItem[] = [
  { title: "Dashboard", url: "/dashboard", icon: HomeIcon },
  { title: "Explore", url: "/dashboard/explore", icon: DoorIcon },
  // TODO: Add Favorites
  // { title: "Favorites", url: "/dashboard/favorites", icon: HeartIcon },
  {
    title: "Rentals",
    icon: CalendarIcon,
    items: [
      {
        label: "Renter",
        items: [
          { title: "Requests", url: "/dashboard/renting/requests" },
          { title: "Approved", url: "/dashboard/renting/approved" },
          { title: "Active", url: "/dashboard/renting/active" },
          { title: "Completed", url: "/dashboard/renting/completed" },
          { title: "Denied", url: "/dashboard/renting/denied" },
        ],
      },
      {
        label: "Owner",
        items: [
          { title: "Incoming", url: "/dashboard/lending/incoming" },
          { title: "Approved", url: "/dashboard/lending/approved" },
          { title: "Active", url: "/dashboard/lending/active" },
          { title: "Completed", url: "/dashboard/lending/completed" },
          { title: "Denied", url: "/dashboard/lending/denied" },
        ],
      },
    ],
  },
  { title: "Garage", url: "/dashboard/garage", icon: WarehouseIcon },
  { title: "Mailbox", url: "/dashboard/mailbox", icon: MailIcon },
  { title: "Payments", url: "/dashboard/payments", icon: DollarSign },
  { title: "Profile", url: "/dashboard/profile", icon: UserIcon },
];

export interface SecondaryNavItem {
  readonly title: string;
  readonly url: string;
  readonly icon: IconComponent;
}

export const NAV_SECONDARY: readonly SecondaryNavItem[] = [
  { title: "Settings", url: "#", icon: SettingsIcon },
  { title: "Get Help", url: "#", icon: HelpCircleIcon },
  { title: "Search", url: "#", icon: SearchIcon },
];

export interface DocumentLink {
  readonly name: string;
  readonly url: string;
  readonly icon: IconComponent;
}

export const DOCUMENT_LINKS: readonly DocumentLink[] = [
  { name: "Rental Agreements", url: "/agreements", icon: FileSignatureIcon },
  { name: "Invoices & Receipts", url: "/invoices", icon: CreditCardIcon },
  { name: "Safety Manuals", url: "/safety-manuals", icon: BookOpenIcon },
  { name: "FAQs", url: "/faq", icon: HelpCircleIcon },
];

export interface UserData {
  readonly name: string;
  readonly firstName: string;
  readonly email: string;
  readonly avatar: string;
  readonly initials: string;
}

export interface DashboardConstants {
  readonly mainNav: readonly MainNavItem[];
  readonly navSecondary: readonly SecondaryNavItem[];
  readonly documents: readonly DocumentLink[];
}

export const DASHBOARD: DashboardConstants = {
  mainNav: MAIN_NAV,
  navSecondary: NAV_SECONDARY,
  documents: DOCUMENT_LINKS,
};
