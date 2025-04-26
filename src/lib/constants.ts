import DoorIcon from "@/components/svg/door";
import { WarehouseIcon, HeartIcon, UserIcon, MailIcon } from "lucide-react";

export const mainNav = [
  {
    title: "Explore",
    url: "/explore",
    icon: DoorIcon,
  },
  {
    title: "Favorites",
    url: "/favorites",
    icon: HeartIcon,
  },
  {
    title: "Garage",
    url: "/garage",
    icon: WarehouseIcon,
  },
  {
    title: "Mailbox",
    url: "/mailbox",
    icon: MailIcon,
  },
  {
    title: "Profile",
    url: "/profile",
    icon: UserIcon,
  },
];
