"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/vorrat", label: "Vorrat", icon: "🥫" },
  { href: "/kochen", label: "Kochen", icon: "🍳" },
  { href: "/scan", label: "Scannen", icon: "📷", big: true },
  { href: "/einkauf", label: "Einkauf", icon: "🛒" },
  { href: "/einstellungen", label: "Mehr", icon: "⚙️" },
];

// Die Leiste unten: immer mit dem Daumen erreichbar, der Scan-Knopf groß in der Mitte
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-stone-200 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-stone-700">
      <ul className="mx-auto flex max-w-md items-end">
        {TABS.map((tab) => {
          const active = pathname.startsWith(tab.href);
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 py-2 text-xs ${
                  active ? "font-semibold text-emerald-700 dark:text-emerald-400" : "text-stone-500"
                }`}
              >
                {tab.big ? (
                  <span className="-mt-7 flex size-14 items-center justify-center rounded-full bg-emerald-700 text-2xl text-white shadow-lg ring-4 ring-background" aria-hidden>
                    {tab.icon}
                  </span>
                ) : (
                  <span className="text-2xl" aria-hidden>
                    {tab.icon}
                  </span>
                )}
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
