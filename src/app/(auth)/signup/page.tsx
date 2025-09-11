import { SignupForm } from "@/features/auth/components/signup-form";

export default function SignupPage() {
  return (
    <div className="bg-muted/40 flex min-h-screen flex-col items-center justify-center p-4">
      <SignupForm />
    </div>
  );
}
