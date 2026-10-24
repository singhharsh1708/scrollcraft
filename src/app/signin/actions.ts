"use server";
import { authConfigured, authInstance, configuredProviders, type SignInProvider } from "@/auth";
import { safeNext } from "./next";

/**
 * Server actions rather than fetches to the Auth.js endpoints: the post goes to the page
 * the visitor is already on, and Auth.js handles the CSRF token and the redirect itself.
 */

/** Sign in with one of the configured providers and come back to `next`, a path on this site. */
export async function signInWith(provider: string, next: string): Promise<void> {
  if (!authConfigured()) return;
  if (!configuredProviders().includes(provider as SignInProvider)) return;
  await (await authInstance()).signIn(provider, { redirectTo: safeNext(next) });
}

export async function endSession(): Promise<void> {
  if (!authConfigured()) return;
  await (await authInstance()).signOut({ redirectTo: "/" });
}
