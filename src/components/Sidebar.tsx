"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import SignOutButton from "@/components/SignOutButton";
import { User } from "@supabase/supabase-js";

interface SidebarProps {
  user: User | null;
}

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

export default function Sidebar({ user }: SidebarProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setSidebarOpen(false); // Close sidebar on route change
  }, [pathname]);

  return (
    <>
      {/* Hamburger menu button for mobile */}
      <button
        className="md:hidden fixed top-4 left-4 z-50 p-2 rounded-md bg-gray-900 border border-gray-800 text-white"
        onClick={() => setSidebarOpen(true)}
        aria-label="Open sidebar"
      >
        ☰
      </button>

      {/* Backdrop for mobile sidebar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <nav
          className="fixed inset-y-0 left-0 w-64 bg-gray-900 z-50 border-r border-gray-800 flex flex-col p-4 shrink-0 transition-transform duration-300 ease-in-out translate-x-0 md:hidden"
        >
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
                  className={`flex items-center gap-3 py-2 rounded-lg text-sm transition-colors ${
                    pathname === item.href
                      ? "border-l-2 border-amber-500 pl-3 text-white"
                      : "pl-5 text-gray-400 hover:text-white hover:bg-gray-800"
                  }`}
                  onClick={() => setSidebarOpen(false)} // Close sidebar on nav click
                >
                  <span className="text-base">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="pt-4 border-t border-gray-800 space-y-2 pl-4">
            {user && (
              <p className="text-xs text-gray-600 font-mono truncate">
                {user.email}
              </p>
            )}
            <SignOutButton />
          </div>
        </nav>
      )}

      {/* Desktop Sidebar */}
      <nav
        className="hidden md:flex md:flex-col md:w-64 bg-gray-900 border-r border-gray-800 p-4 shrink-0 md:h-screen"
      >
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
                className={`flex items-center gap-3 py-2 rounded-lg text-sm transition-colors ${
                  pathname === item.href
                    ? "border-l-2 border-amber-500 pl-3 text-white"
                    : "pl-5 text-gray-400 hover:text-white hover:bg-gray-800"
                }`}
                onClick={() => setSidebarOpen(false)} // Close sidebar on nav click
              >
                <span className="text-base">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
        <div className="pt-4 border-t border-gray-800 space-y-2 pl-4">
          {user && (
            <p className="text-xs text-gray-600 font-mono truncate">
              {user.email}
            </p>
          )}
          <SignOutButton />
        </div>
      </nav>
    </>
  );
}