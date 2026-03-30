import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Life OS",
  description: "Your personal operating system",
};

const navItems = [
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/tasks", label: "Tasks", icon: "📋" },
  { href: "/habits", label: "Habits", icon: "🔁" },
  { href: "/finances", label: "Finances", icon: "💰" },
  { href: "/journal", label: "Journal", icon: "📔" },
  { href: "/goals", label: "Goals", icon: "🎯" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-gray-100 antialiased">
        <div className="flex h-screen">
          {/* Sidebar */}
          <nav className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col p-4 shrink-0">
            <div className="mb-8">
              <h1 className="text-xl font-bold text-white tracking-tight">
                ⚡ Life OS
              </h1>
              <p className="text-xs text-gray-500 mt-1">
                Your personal system
              </p>
            </div>
            <ul className="space-y-1 flex-1">
              {navItems.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="text-xs text-gray-600 pt-4 border-t border-gray-800">
              Built with SQLite
            </div>
          </nav>

          {/* Main Content */}
          <main className="flex-1 overflow-y-auto p-8">{children}</main>
        </div>
      </body>
    </html>
  );
}