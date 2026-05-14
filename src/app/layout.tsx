import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { auth } from "@/auth";
import { SessionProvider } from "@/lib/auth/session-context";
import { Sidebar } from "@/components/layout/sidebar";
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
          <div className="flex h-full">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0">
              <header className="h-14 border-b flex items-center justify-between px-6 bg-card shrink-0 shadow-sm">
                <div />
                <div className="flex items-center gap-4">
                  <AuthUserMenu />
                </div>
              </header>
              <main className="flex-1 overflow-auto p-6 bg-muted/40">
                {children}
              </main>
            </div>
          </div>
        </SessionProvider>
      </body>
    </html>
  );
}
