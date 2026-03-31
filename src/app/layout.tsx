import type { Metadata } from "next";
import "./globals.css";
import { createClient } from "@/lib/supabase-server";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "Life OS",
  description: "Your personal operating system",
};

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
      <body className="bg-gray-950 text-gray-100 antialiased">
        <div className="flex flex-col md:flex-row h-screen">
          <Sidebar user={user} />

          {/* Main Content */}
          <main className="flex-1 overflow-y-auto p-4 md:p-8 lg:ml-64">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
