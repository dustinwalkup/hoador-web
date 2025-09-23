// TODO: remove this file
// "use server";

// import { redirect } from "next/navigation";
// import { tryCatch } from "@walkup/walkup-utils";
// import { signInEmail } from "../utils";
// import { loginSchema } from "../schemas/validation";

// type LoginResult = {
//   success: boolean;
//   error?: string;
// };

// export async function loginAction(
//   prevState: LoginResult | null,
//   formData: FormData,
// ): Promise<LoginResult> {
//   const email = formData.get("email") as string;
//   const password = formData.get("password") as string;
//   const callbackUrl = (formData.get("callbackUrl") as string) || "/dashboard";

//   // Validate form data
//   try {
//     loginSchema.parse({ email, password });
//   } catch {
//     return {
//       success: false,
//       error: "Please check your email and password.",
//     };
//   }

//   // Sign in with Better Auth using your existing function
//   const { error } = await tryCatch(signInEmail(email, password));

//   if (error) {
//     console.error("Better Auth login error:", error);

//     if (error.message?.includes("email not verified")) {
//       return {
//         success: false,
//         error: "Please verify your email address before signing in.",
//       };
//     }

//     if (
//       error.message?.includes("invalid") ||
//       error.message?.includes("credentials") ||
//       error.message?.includes("password")
//     ) {
//       return {
//         success: false,
//         error: "Invalid email or password. Please try again.",
//       };
//     }

//     return {
//       success: false,
//       error: "Failed to sign in. Please try again.",
//     };
//   }

//   console.log("*************** Login successful ***************");
//   console.log("Redirecting to:", callbackUrl);

//   // Success! Redirect to callback URL
//   redirect("/verify-email");
// }
