import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";
import authConfig from "@/auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(db),
  session: { strategy: "database" },
  callbacks: {
    async session({ session, user }) {
      if (session.user && user?.id) {
        session.user.id = user.id;
        const fresh = await db.user.findUnique({
          where: { id: user.id },
          select: { plan: true, credits: true },
        });
        if (fresh) {
          session.user.plan = fresh.plan;
          session.user.credits = fresh.credits;
        }
      }
      return session;
    },
  },
});
