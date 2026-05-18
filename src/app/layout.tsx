import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { auth } from "@/auth";
import { SessionProvider } from "@/lib/auth/session-context";
import { AppShell } from "@/components/layout/app-shell";
import { AuthUserMenu } from "@/components/layout/auth-user-menu";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });

export const metadata: Metadata = {
  title: "MOVE AVARIAS",
  description: "Sistema de Controle de Ocorrências de Avarias",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <html lang="pt-BR" className={`${geist.variable} h-full antialiased`}>
      <body className="h-full">
        <SessionProvider session={session}>
          <AppShell header={<AuthUserMenu />}>
            {children}
          </AppShell>
        </SessionProvider>
      </body>
    </html>
  );
}
