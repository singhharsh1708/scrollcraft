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

/**
 * Sign in and come back to the page that asked.
 *
 * Only a path on this site is accepted. Anything else, including a scheme-relative
 * address that would leave it, falls back to the home page, so a crafted form cannot use
 * the sign-in as a redirect to somewhere else.
 */
export async function signInAndReturn(formData: FormData): Promise<void> {
  if (!authConfigured()) return;
  const next = String(formData.get("next") ?? "/");
  const redirectTo = /^\/(?!\/)[A-Za-z0-9\-._~/?=&%]*$/.test(next) ? next : "/";
  await (await authInstance()).signIn("github", { redirectTo });
}

export async function endSession(): Promise<void> {
  if (!authConfigured()) return;
  await (await authInstance()).signOut({ redirectTo: "/" });
}
