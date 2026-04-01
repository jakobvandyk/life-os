import type { Metadata } from "next";
import "./globals.css";
import { createClient } from "@/lib/supabase-server";
import Sidebar from "@/components/Sidebar";
import { Press_Start_2P, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";

export const metadata: Metadata = {
  title: "Life OS",
  description: "Your personal operating system",
};

const pressStart = Press_Start_2P({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-pixel-var",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-mono-var",
  display: "swap",
});

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans-var",
  display: "swap",
});

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className={`${pressStart.variable} ${plexMono.variable} ${plexSans.variable} font-sans antialiased`}>
        <div className="flex h-screen">
          <Sidebar user={user} />

          {/* Main Content */}
          <main className="relative z-10 flex-1 overflow-y-auto p-4 md:p-6">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
