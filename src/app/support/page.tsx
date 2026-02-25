import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Support - Hoador",
  description: "Community Support Coming Soon",
};

export default function SupportPage() {
  return (
    <div className="page-container flex h-screen flex-col items-center justify-center text-center">
      <p className="text-2xl font-bold">Community Support Coming Soon</p>
      <p className="text-lg">
        For immediate help please email us at{" "}
        <a href="mailto:admin@hoador.com" className="text-primary font-bold">
          admin@hoador.com
        </a>
      </p>
    </div>
  );
}
