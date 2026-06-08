import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      plan?: string;
      credits?: number;
    } & DefaultSession["user"];
  }
}
