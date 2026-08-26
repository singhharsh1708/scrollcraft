import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";
import { isPlanActive } from "@/lib/plans";
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
          select: { plan: true, planExpiresAt: true },
        });
        if (fresh) {
          // A paid plan past its expiry lapses to FREE. Downgrade lazily here so every
          // server route that reads the user row after auth() sees the corrected plan.
          if (fresh.plan !== "FREE" && !isPlanActive(fresh.planExpiresAt)) {
            await db.user.update({
              where: { id: user.id },
              data: { plan: "FREE", planExpiresAt: null },
            });
            session.user.plan = "FREE";
          } else {
            session.user.plan = fresh.plan;
          }
        }
      }
      return session;
    },
  },
});
