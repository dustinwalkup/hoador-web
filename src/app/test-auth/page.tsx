"use client";

import { authClient } from "@/lib/auth/auth-client";
import { useState } from "react";

export default function TestAuthPage() {
  const { data: session, isPending } = authClient.useSession();
  const [loading, setLoading] = useState(false);
  const [emailForm, setEmailForm] = useState({
    email: "",
    password: "",
    name: "",
  });

  const signInWithGoogle = async () => {
    setLoading(true);
    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: "/dashboard",
      });
    } catch (error) {
      console.error("Google sign in error:", error);
      setLoading(false);
    }
  };

  const signUpWithEmail = async () => {
    setLoading(true);
    try {
      const result = await authClient.signUp.email({
        email: emailForm.email,
        password: emailForm.password,
        name: emailForm.name,
      });
      console.log("Sign up result:", result);
    } catch (error) {
      console.error("Email sign up error:", error);
      alert(
        "Sign up failed: " +
          (error instanceof Error ? error.message : "Unknown error"),
      );
    } finally {
      setLoading(false);
    }
  };

  const signInWithEmail = async () => {
    setLoading(true);
    try {
      const result = await authClient.signIn.email({
        email: emailForm.email,
        password: emailForm.password,
      });
      console.log("Sign in result:", result);
    } catch (error) {
      console.error("Email sign in error:", error);
      alert(
        "Sign in failed: " +
          (error instanceof Error ? error.message : "Unknown error"),
      );
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    await authClient.signOut();
  };

  if (isPending) {
    return <div className="p-8">Loading session...</div>;
  }

  return (
    <div className="mx-auto max-w-md p-8">
      <h1 className="mb-4 text-2xl font-bold">Test Authentication</h1>

      {session?.user ? (
        <div className="space-y-4">
          <div className="rounded border border-green-200 bg-green-50 p-4">
            <h2 className="font-semibold text-green-800">Signed in as:</h2>
            <p className="text-green-700">{session.user.email}</p>
            <p className="text-green-700">{session.user.name}</p>
            <p className="text-xs text-green-600">ID: {session.user.id}</p>
            {session.user.image && (
              <img
                src={session.user.image}
                alt="Profile"
                className="mt-2 h-12 w-12 rounded-full"
              />
            )}
          </div>
          <button
            onClick={signOut}
            className="w-full rounded bg-red-500 p-2 text-white hover:bg-red-600"
          >
            Sign Out
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <p className="text-gray-600">Not signed in</p>

          {/* Google OAuth */}
          <button
            onClick={signInWithGoogle}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded bg-blue-500 p-3 text-white hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? (
              "Signing in..."
            ) : (
              <>
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Sign in with Google
              </>
            )}
          </button>

          <div className="text-center text-gray-500">or</div>

          {/* Email/Password Form */}
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Full Name"
              value={emailForm.name}
              onChange={(e) =>
                setEmailForm({ ...emailForm, name: e.target.value })
              }
              className="w-full rounded border p-2"
            />
            <input
              type="email"
              placeholder="Email"
              value={emailForm.email}
              onChange={(e) =>
                setEmailForm({ ...emailForm, email: e.target.value })
              }
              className="w-full rounded border p-2"
            />
            <input
              type="password"
              placeholder="Password (min 8 chars)"
              value={emailForm.password}
              onChange={(e) =>
                setEmailForm({ ...emailForm, password: e.target.value })
              }
              className="w-full rounded border p-2"
            />

            <div className="flex gap-2">
              <button
                onClick={signUpWithEmail}
                disabled={loading}
                className="flex-1 rounded bg-green-500 p-2 text-white hover:bg-green-600 disabled:opacity-50"
              >
                Sign Up
              </button>
              <button
                onClick={signInWithEmail}
                disabled={loading}
                className="flex-1 rounded bg-gray-500 p-2 text-white hover:bg-gray-600 disabled:opacity-50"
              >
                Sign In
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
