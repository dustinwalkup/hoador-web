import { tryCatch } from "@walkup/walkup-utils";
import { EmailConfirmationForm } from "@/features/auth/components/email-confirmation-form";
import { userDAL } from "@/dal";

interface VerifyEmailPageProps {
  searchParams: Promise<{
    email?: string | string[] | undefined;
  }>;
}

// Utility function to get user by email
async function getUserForVerification(email: string) {
  const { data: userData, error: userError } = await tryCatch(
    userDAL.getUserByEmailForAuth(email),
  );

  if (userError) {
    console.error("Failed to fetch user by email:", userError);
    throw new Error("Unable to verify email. Please try again later.");
  }

  if (!userData) {
    throw new Error("User not found. Please check your email or sign up.");
  }

  return userData;
}

// Error component
function ErrorPage({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <h2 className="mb-2 text-xl font-semibold text-red-700">Error</h2>
        <p className="text-red-600">{message}</p>
      </div>
    </div>
  );
}

export default async function VerifyEmailPage({
  searchParams,
}: VerifyEmailPageProps) {
  // Extract and validate email parameter
  const emailParam = (await searchParams).email;
  const email = Array.isArray(emailParam) ? emailParam[0] : emailParam;

  if (!email) {
    return <ErrorPage message="Email parameter is required" />;
  }

  // Get user data with error handling
  try {
    const userData = await getUserForVerification(email);
    return <EmailConfirmationForm email={email} userId={userData.id} />;
  } catch (error) {
    return (
      <ErrorPage
        message={
          error instanceof Error
            ? error.message
            : "An unexpected error occurred"
        }
      />
    );
  }
}
