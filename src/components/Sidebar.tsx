"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import SyncStatus from "@/components/SyncStatus";
import PixelIcon, { ICON_NAMES } from "@/components/PixelIcon";
import { User } from "@supabase/supabase-js";

interface SidebarProps {
  user: User | null;
}

const navSections = [
  { label: null, items: [{ href: "/", label: "Dashboard" }] },
  { label: "LIFE", items: [
    { href: "/tasks", label: "Tasks" },
    { href: "/habits", label: "Habits" },
    { href: "/calendar", label: "Calendar" },
  ]},
  { label: "TRACK", items: [
    { href: "/workouts", label: "Workouts" },
    { href: "/finances", label: "Finances" },
    { href: "/knowledge", label: "Knowledge" },
  ]},
  { label: "REFLECT", items: [
    { href: "/journal", label: "Journal" },
    { href: "/goals", label: "Goals" },
    { href: "/review", label: "Review" },
  ]},
  { label: "SYSTEM", items: [
    { href: "/chat", label: "AI Chat" },
    { href: "/settings", label: "Settings" },
  ]},
];

function NavList({
  pathname,
  onNav,
}: {
  pathname: string;
  onNav: () => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto">
      {navSections.map((section, si) => (
        <div key={si}>
          {section.label && (
            <p className="font-mono text-[8px] text-desert-text-3/60 uppercase tracking-[0.15em] mt-4 mb-1 pl-5">
              {section.label}
            </p>
          )}
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`group flex items-center gap-3 py-2 rounded-sm text-sm transition-all duration-150 ${
                      active
                        ? "border-l-2 border-desert-accent pl-3 text-desert-text bg-desert-accent/10"
                        : "pl-5 text-desert-text-3 hover:text-desert-text hover:bg-desert-surface-hover"
                    }`}
                    onClick={onNav}
                  >
                    <PixelIcon
                      name={ICON_NAMES[item.href] || "dashboard"}
                      size={16}
                      className={`transition-colors duration-150 ${
                        active
                          ? "text-desert-accent"
                          : "text-desert-text-3 group-hover:text-desert-accent"
                      }`}
                    />
                    <span className="font-pixel text-[10px]">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

export default function Sidebar({ user }: SidebarProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLight, setIsLight] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    setIsLight(document.documentElement.classList.contains("light"));
  }, []);

  const toggleTheme = () => {
    const next = !isLight;
    document.documentElement.classList.toggle("light", next);
    localStorage.setItem("theme", next ? "light" : "dark");
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", next ? "#f5efe6" : "#1a1714");
    setIsLight(next);
  };

  const closeNav = () => setSidebarOpen(false);

  return (
    <>
      {/* Hamburger menu button for mobile */}
      <button
        className="md:hidden fixed top-4 left-4 z-50 p-2 rounded-md bg-desert-surface border border-desert-border text-desert-text-2 hover:text-desert-text hover:border-desert-border-strong transition-colors duration-150"
        onClick={() => setSidebarOpen(true)}
        aria-label="Open sidebar"
      >
        ☰
      </button>

      {/* Backdrop for mobile sidebar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-desert-bg/80 backdrop-blur-sm z-40 md:hidden"
          onClick={closeNav}
        />
      )}

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <nav className="fixed inset-y-0 left-0 w-64 bg-desert-surface z-50 border-r border-desert-border flex flex-col p-4 shrink-0 md:hidden">
          <div className="mb-6">
            <h1 className="font-pixel text-desert-accent text-[10px] uppercase tracking-tight">
              ⚡ LIFE OS
            </h1>
            <p className="font-mono text-desert-text-3 text-[9px] tracking-wider uppercase mt-1">
              Your personal system
            </p>
          </div>
          <NavList pathname={pathname} onNav={closeNav} />
          <div className="pt-4 border-t border-desert-border space-y-2 pl-4">
            {user && (
              <p className="font-mono text-desert-text-3 text-[9px] truncate">
                {user.email}
              </p>
            )}
            <button
              onClick={toggleTheme}
              className="font-pixel text-[9px] text-desert-text-3 hover:text-desert-accent transition-colors uppercase tracking-wider"
              aria-label={isLight ? "Switch to dark mode" : "Switch to light mode"}
            >
              {isLight ? "☽ DARK" : "☀ LIGHT"}
            </button>
            <SyncStatus />
          </div>
        </nav>
      )}

      {/* Desktop Sidebar */}
      <nav className="hidden md:flex md:flex-col md:w-64 bg-desert-bg-secondary border-r border-desert-border p-4 shrink-0 md:h-screen relative z-10">
        <div className="mb-6">
          <h1 className="font-pixel text-desert-accent text-[10px] uppercase tracking-tight">
            ⚡ LIFE OS
          </h1>
          <p className="font-mono text-desert-text-3 text-[9px] tracking-wider uppercase mt-1">
            Your personal system
          </p>
        </div>
        <NavList pathname={pathname} onNav={closeNav} />
        <div className="pt-4 border-t border-desert-border space-y-2 pl-4">
          {user && (
            <p className="font-mono text-desert-text-3 text-[9px] truncate">
              {user.email}
            </p>
          )}
          <button
            onClick={toggleTheme}
            className="font-pixel text-[9px] text-desert-text-3 hover:text-desert-accent transition-colors uppercase tracking-wider"
            aria-label={isLight ? "Switch to dark mode" : "Switch to light mode"}
          >
            {isLight ? "☽ DARK" : "☀ LIGHT"}
          </button>
          <SyncStatus />
        </div>
      </nav>
    </>
  );
}
