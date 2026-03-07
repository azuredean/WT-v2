"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/dashboard/whale-tracker", label: "Whale Tracker", icon: "🐳" },
  { href: "/dashboard/signals", label: "Signals", icon: "⚡" },
  { href: "/dashboard/backtest", label: "Backtest", icon: "📈" },
  { href: "/dashboard/positions", label: "Positions", icon: "💼" },
  { href: "/dashboard/settings", label: "Settings", icon: "⚙️" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-56 flex-col border-r border-border bg-bg-secondary">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <span className="text-xl">🐳</span>
        <span className="text-sm font-semibold text-text-primary">
          Whale Tracker V2
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname?.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                isActive
                  ? "bg-bg-hover text-text-primary"
                  : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Status */}
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <span className="h-2 w-2 rounded-full bg-green" />
          Connected
        </div>
      </div>
    </aside>
  );
}
