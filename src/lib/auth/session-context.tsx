"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { SessionUser } from "./types";

interface SessionContextType {
  user: SessionUser | null;
  setUser: (user: SessionUser) => void;
  users: SessionUser[];
}

const SessionContext = createContext<SessionContextType>({
  user: null,
  setUser: () => {},
  users: [],
});

export function SessionProvider({
  children,
  users,
}: {
  children: ReactNode;
  users: SessionUser[];
}) {
  const [user, setUserState] = useState<SessionUser | null>(() => {
    if (typeof window === "undefined") return null;
    const stored = localStorage.getItem("move-avarias-user");
    if (stored) {
      const parsed = JSON.parse(stored) as SessionUser;
      const found = users.find((u) => u.id === parsed.id);
      if (found) return found;
    }
    return users[0] ?? null;
  });

  const setUser = (u: SessionUser) => {
    setUserState(u);
    localStorage.setItem("move-avarias-user", JSON.stringify(u));
  };

  return (
    <SessionContext.Provider value={{ user, setUser, users }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}
