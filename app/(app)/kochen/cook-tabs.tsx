import Link from "next/link";

const TABS = [
  { href: "/kochen", label: "🍳 Vorschläge" },
  { href: "/plan", label: "📅 Wochenplan" },
  { href: "/kochen/rezeptbuch", label: "★ Rezeptbuch" },
] as const;

/** Umschalter oben im Bereich „Kochen“: Vorschläge, Wochenplan, Rezeptbuch */
export function CookTabs({ current }: { current: (typeof TABS)[number]["href"] }) {
  return (
    <nav className="flex gap-1 rounded-xl bg-stone-100 p-1 text-sm dark:bg-stone-800">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={tab.href === current ? "page" : undefined}
          className={`flex-1 rounded-lg px-2 py-2 text-center ${
            tab.href === current ? "bg-white font-semibold shadow-sm dark:bg-stone-900" : "text-stone-600 dark:text-stone-400"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
