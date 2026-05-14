import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
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
      authorize() {
        // PoC only — no real DB or password check
        return null;
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.sub = user.id ?? "";
        token.clientId = (user.clientId ?? "") as string;
        token.role = (user.role ?? "SEPARADOR") as UserRole;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.sub ?? "";
      session.user.clientId = (token.clientId ?? "") as string;
      session.user.role = (token.role ?? "SEPARADOR") as UserRole;
      return session;
    },
  },
});
