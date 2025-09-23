import Link from "next/link";
import { SignupForm } from "@/features/auth/components/signup-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AuthLayoutWrapper } from "@/features/auth/components/auth-layout-wrapper";

export default function SignupPage() {
  return (
    <AuthLayoutWrapper>
      <Card className="mx-auto w-full max-w-md">
        <CardHeader className="pt-4">
          <CardTitle className="text-2xl">Create an account</CardTitle>
          <CardDescription>
            Enter your details to get started with Hoador
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignupForm />
        </CardContent>
        <CardFooter className="flex flex-col items-center gap-4">
          <div className="text-muted-foreground text-center text-sm">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline">
              Log in
            </Link>
          </div>
        </CardFooter>
      </Card>
    </AuthLayoutWrapper>
  );
}
