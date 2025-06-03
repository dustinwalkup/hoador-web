import type { FunctionComponent, SVGProps } from "react";
import {
  WarehouseIcon,
  HeartIcon,
  UserIcon,
  MailIcon,
  HomeIcon,
  BookOpenIcon,
  CreditCardIcon,
  FileSignatureIcon,
  HelpCircleIcon,
  SearchIcon,
  SettingsIcon,
} from "lucide-react";
import DoorIcon from "@/components/svg/door";

export type IconComponent = FunctionComponent<SVGProps<SVGSVGElement>>;

export interface MainNavItem {
  readonly title: string;
  readonly url: string;
  readonly icon: IconComponent;
}

export const MAIN_NAV: MainNavItem[] = [
  { title: "Dashboard", url: "/dashboard", icon: HomeIcon },
  { title: "Explore", url: "/dashboard/explore", icon: DoorIcon },
  { title: "Favorites", url: "/dashboard/favorites", icon: HeartIcon },
  { title: "Garage", url: "/dashboard/garage", icon: WarehouseIcon },
  { title: "Mailbox", url: "/dashboard/mailbox", icon: MailIcon },
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

export const USER: UserData = {
  name: "Tyler Durden",
  firstName: "Tyler",
  initials: "TD",
  email: "tyler@example.com",
  avatar: "/images/mock/testUser.jpg",
};

export interface DashboardConstants {
  readonly mainNav: readonly MainNavItem[];
  readonly user: UserData;
  readonly navSecondary: readonly SecondaryNavItem[];
  readonly documents: readonly DocumentLink[];
}

export const DASHBOARD: DashboardConstants = {
  mainNav: MAIN_NAV,
  user: USER,
  navSecondary: NAV_SECONDARY,
  documents: DOCUMENT_LINKS,
};
