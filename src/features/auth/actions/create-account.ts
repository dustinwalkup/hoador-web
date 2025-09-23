// TODO: remove this file
// "use server";

// import { redirect } from "next/navigation";
// import { tryCatch } from "@walkup/walkup-utils";
// import { auth } from "@/services/better-auth";
// import { emailSignupSchema } from "../schemas/validation";
// import { getSession } from "../utils/session";

// type CreateAccountResult = {
//   success: boolean;
//   error?: string;
//   data?: {
//     user: {
//       id: string;
//       email: string;
//     };
//   };
// };

// export async function createAccountAction(
//   prevState: CreateAccountResult | null,
//   formData: FormData,
// ): Promise<CreateAccountResult> {
//   // Extract and structure form data
//   const userData = {
//     email: (formData.get("email") as string) || "",
//     password: (formData.get("password") as string) || "",
//   };

//   // Server-side validation
//   try {
//     emailSignupSchema.parse(userData);
//   } catch (error) {
//     console.error("Email signup server schema error:", error);
//     return {
//       success: false,
//       error: "Please check your information and try again.",
//     };
//   }

//   const validatedData = emailSignupSchema.parse(userData);

//   // Create user account using Better Auth
//   const { data: betterAuthResult, error: authError } = await tryCatch(
//     auth.api.signUpEmail({
//       body: {
//         name: "User",
//         email: validatedData.email,
//         password: validatedData.password,
//       },
//     }),
//   );
//   if (authError) {
//     console.error("Better Auth error:", authError);

//     // Handle specific Better Auth errors
//     if (
//       authError.message?.includes("email") ||
//       authError.message?.includes("already exists")
//     ) {
//       return {
//         success: false,
//         error: "An account with this email already exists.",
//       };
//     }

//     return {
//       success: false,
//       error: "Failed to create account. Please try again.",
//     };
//   }

//   if (!betterAuthResult) {
//     return {
//       success: false,
//       error: "Failed to create user account.",
//     };
//   }

//   // Check if user is now signed in (Better Auth should handle this automatically)
//   const session = await getSession();

//   if (!session) {
//     // Fallback: manually sign in if auto sign-in didn't work
//     const { error: signInError } = await tryCatch(
//       auth.api.signInEmail({
//         body: {
//           email: validatedData.email,
//           password: validatedData.password,
//         },
//       }),
//     );

//     if (signInError) {
//       redirect("/login");
//     }
//   }

//   // Redirect to verification page (user should now be signed in)
//   redirect(`/verify-email?email=${validatedData.email}`);
// }
