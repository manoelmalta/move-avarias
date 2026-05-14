"use client";

import { SessionProvider as NextAuthProvider, useSession as useNextAuthSession } from "next-auth/react";
import type { Session } from "next-auth";
import type { ReactNode } from "react";
import type { SessionUser } from "./types";

export function SessionProvider({
  children,
  session,
}: {
  children: ReactNode;
  session?: Session | null;
}) {
  return (
    <NextAuthProvider session={session}>
      {children}
    </NextAuthProvider>
  );
}

export function useSession(): { user: SessionUser | null } {
  const { data } = useNextAuthSession();
  if (!data?.user) return { user: null };
  return { user: data.user as SessionUser };
}
