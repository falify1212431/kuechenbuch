import { BottomNav } from "./bottom-nav";

// Rahmen für alle Bereiche nach dem Login: Inhalt oben, Navigationsleiste unten.
// Der Ordnername „(app)“ in Klammern taucht nicht in der Adresse auf.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <main className="mx-auto min-h-dvh max-w-md px-4 pt-6 pb-28">{children}</main>
      <BottomNav />
    </>
  );
}
