import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/client";
import type { UserRole } from "@/lib/auth/types";

declare module "next-auth" {
  interface User {
    id: string;
    clientId: string;
    role: UserRole;
  }
  interface Session {
    user: {
      id: string;
      clientId: string;
      name: string;
      email: string;
      role: UserRole;
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    clientId: string;
    role: UserRole;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = String(credentials.email).trim().toLowerCase();
        const password = String(credentials.password);

        const user = await prisma.user.findFirst({ where: { email } });

        if (!user || !user.active || !user.passwordHash) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          clientId: user.clientId,
          name: user.name,
          email: user.email,
          role: user.role as UserRole,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    authorized({ auth: session, request }) {
      const { pathname } = request.nextUrl;
      const isLoggedIn = !!session?.user;

      if (pathname.startsWith("/api/auth")) return true;

      if (pathname.startsWith("/api/")) {
        return isLoggedIn ? true : Response.json({ error: "Unauthorized" }, { status: 401 });
      }

      if (pathname === "/login") {
        if (isLoggedIn) return Response.redirect(new URL("/dashboard", request.url));
        return true;
      }

      return isLoggedIn;
    },
    jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.clientId = user.clientId as string;
        token.role = user.role as UserRole;
        token.name = user.name;
        token.email = user.email;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.sub ?? "";
      session.user.clientId = (token.clientId ?? "") as string;
      session.user.role = (token.role ?? "SEPARADOR") as UserRole;
      session.user.name = (token.name ?? "") as string;
      session.user.email = (token.email ?? "") as string;
      return session;
    },
  },
});
