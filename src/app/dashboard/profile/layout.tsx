import { notFound } from "next/navigation";
import { getCurrentUser } from "@/features/auth/auth.utils";

interface ProfileLayoutProps {
  children: React.ReactNode;
}

export default async function ProfileLayout({ children }: ProfileLayoutProps) {
  const user = await getCurrentUser();
  if (!user) return notFound();

  return <>{children}</>;
}
