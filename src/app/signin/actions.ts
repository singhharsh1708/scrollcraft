"use server";
import { authConfigured, authInstance } from "@/auth";

/**
 * The two things the nav can do.
 *
 * Server actions rather than fetches to the Auth.js endpoints: the post goes to the page
 * the visitor is already on, which the content security policy's `form-action 'self'`
 * allows, and Auth.js handles the CSRF token and the redirect to GitHub itself.
 */

export async function startGitHubSignIn(): Promise<void> {
  if (!authConfigured()) return;
  await (await authInstance()).signIn("github", { redirectTo: "/" });
}

export async function endSession(): Promise<void> {
  if (!authConfigured()) return;
  await (await authInstance()).signOut({ redirectTo: "/" });
}
