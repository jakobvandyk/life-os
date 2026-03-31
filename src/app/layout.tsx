import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import SignOutButton from "@/components/SignOutButton";

export const metadata: Metadata = {
  title: "Life OS",
  description: "Your personal operating system",
};

const navItems = [
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/tasks", label: "Tasks", icon: "📋" },
  { href: "/habits", label: "Habits", icon: "🔁" },
  { href: "/workouts", label: "Workouts", icon: "🏋️" },
  { href: "/journal", label: "Journal", icon: "📔" },
  { href: "/goals", label: "Goals", icon: "🎯" },
  { href: "/finances", label: "Finances", icon: "💰" },
  { href: "/calendar", label: "Calendar", icon: "📅" },
  { href: "/knowledge", label: "Knowledge", icon: "📚" },
  { href: "/review", label: "Review", icon: "🔄" },
  { href: "/chat", label: "AI Chat", icon: "🤖" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <html lang="en">
      <body className="bg-gray-950 text-gray-100 antialiased">
        <div className="flex h-screen">
          {/* Sidebar */}
          <nav className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col p-4 shrink-0">
            <div className="mb-6">
              <h1 className="text-xl font-bold text-white tracking-tight">
                ⚡ Life OS
              </h1>
              <p className="text-xs text-gray-500 mt-1 font-mono">
                Your personal system
              </p>
            </div>
            <ul className="space-y-0.5 flex-1 overflow-y-auto">
              {navItems.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                  >
                    <span className="text-base">{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="pt-4 border-t border-gray-800 space-y-2">
              {user && (
                <p className="text-xs text-gray-600 font-mono truncate px-1">
                  {user.email}
                </p>
              )}
              <SignOutButton />
            </div>
          </nav>

          {/* Main Content */}
          <main className="flex-1 overflow-y-auto p-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
