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
    permissionOverrides: Record<string, boolean>;
  }
  interface Session {
    user: {
      id: string;
      clientId: string;
      name: string;
      email: string;
      role: UserRole;
      permissionOverrides: Record<string, boolean>;
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    clientId: string;
    role: UserRole;
    permissionOverrides: Record<string, boolean>;
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

        const user = await prisma.user.findFirst({
          where: { email },
          include: { permissionOverrides: { select: { permission: true, granted: true } } },
        });

        if (!user || !user.active || !user.passwordHash) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        const permissionOverrides = Object.fromEntries(
          user.permissionOverrides.map((o) => [o.permission, o.granted])
        );

        return {
          id: user.id,
          clientId: user.clientId,
          name: user.name,
          email: user.email,
          role: user.role as UserRole,
          permissionOverrides,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.clientId = user.clientId as string;
        token.role = user.role as UserRole;
        token.name = user.name;
        token.email = user.email;
        token.permissionOverrides = (user.permissionOverrides ?? {}) as Record<string, boolean>;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.sub ?? "";
      session.user.clientId = (token.clientId ?? "") as string;
      session.user.role = (token.role ?? "SEPARADOR") as UserRole;
      session.user.name = (token.name ?? "") as string;
      session.user.email = (token.email ?? "") as string;
      session.user.permissionOverrides = (token.permissionOverrides ?? {}) as Record<string, boolean>;
      return session;
    },
  },
});
