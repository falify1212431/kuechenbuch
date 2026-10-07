import type { Metadata } from "next";
import Link from "next/link";
import { buttonPrimary, card } from "@/components/styles";
import { mentionsPeanut } from "@/lib/allergens/peanut";
import { nameKey } from "@/lib/cooking/ingredients";
import { check } from "@/lib/data/basics";
import { loadOffers, loadStores } from "@/lib/data/offers";
import { todayInBerlin } from "@/lib/dates";
import { formatPrice, offerMatches, validityLabel, type Offer } from "@/lib/offers/offers";
import { createClient } from "@/lib/supabase/server";
import { addOfferToShopping, deleteOffer } from "./actions";

export const metadata: Metadata = { title: "Angebote" };

function OfferRow({ offer, today, reason }: { offer: Offer; today: string; reason?: string }) {
  const peanut = mentionsPeanut(`${offer.product} ${offer.brand ?? ""}`);
  return (
    <li className="flex items-start gap-2 py-2">
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          {offer.product}
          {offer.brand && <span className="font-normal text-stone-500"> · {offer.brand}</span>}
        </p>
        {peanut && <p className="mt-0.5 inline-block rounded bg-red-600 px-1.5 text-xs font-bold text-white">ERDNUSS</p>}
        <p className="text-sm">
          <strong>{formatPrice(offer.price)}</strong>
          {offer.discount && <span className="text-red-700 dark:text-red-400"> {offer.discount}</span>}
          <span className="text-stone-500">
            {" "}
            · {offer.storeName} · {validityLabel(offer, today)}
            {offer.unitPrice && ` · ${offer.unitPrice}`}
          </span>
        </p>
        {reason && <p className="text-xs text-emerald-700 dark:text-emerald-400">{reason}</p>}
      </div>
      <form action={addOfferToShopping.bind(null, offer.id)}>
        <button type="submit" className="rounded-lg border border-stone-300 px-2.5 py-1.5 text-sm dark:border-stone-600" aria-label={`${offer.product} auf die Einkaufsliste`}>
          + Liste
        </button>
      </form>
      <form action={deleteOffer.bind(null, offer.id)}>
        <button type="submit" className="px-1.5 py-1.5 text-stone-400 hover:text-red-600" aria-label={`${offer.product} löschen`}>
          ✕
        </button>
      </form>
    </li>
  );
}

export default async function OffersPage({ searchParams }: PageProps<"/einkauf/angebote">) {
  const { gespeichert } = await searchParams;
  const today = todayInBerlin();
  const supabase = await createClient();
  const [stores, offers, shopping, history] = await Promise.all([
    loadStores(supabase),
    loadOffers(supabase),
    supabase.from("shopping_items").select("name").eq("checked", false),
    // „Kaufst du öfter“: Namen, die im Vorrat schon mehrmals vorkamen
    supabase.from("pantry_items").select("name").order("created_at", { ascending: false }).limit(500),
  ]);

  const shoppingNames = check(shopping, "Einkaufsliste laden").map((row) => row.name);
  const counts = new Map<string, { name: string; count: number }>();
  for (const row of check(history, "Vorrat laden")) {
    const key = nameKey(row.name);
    counts.set(key, { name: counts.get(key)?.name ?? row.name, count: (counts.get(key)?.count ?? 0) + 1 });
  }
  const frequent = [...counts.values()].filter((entry) => entry.count >= 2).map((entry) => entry.name);

  // Treffer: erst Einkaufsliste, dann „kaufst du öfter“ – jedes Angebot nur einmal
  const highlighted = new Map<string, string>();
  for (const offer of offers) {
    const onList = shoppingNames.find((name) => offerMatches(name, offer));
    if (onList) highlighted.set(offer.id, `Steht auf deiner Einkaufsliste: ${onList}`);
    else {
      const usual = frequent.find((name) => offerMatches(name, offer));
      if (usual) highlighted.set(offer.id, `Kaufst du öfter: ${usual}`);
    }
  }
  const rest = offers.filter((offer) => !highlighted.has(offer.id));
  const byStore = stores
    .map((store) => ({ store, offers: rest.filter((offer) => offer.storeName === store.name) }))
    .filter((group) => group.offers.length > 0);

  return (
    <div className="flex flex-col gap-4">
      <Link href="/einkauf" className="text-stone-600 dark:text-stone-400">
        ← Einkauf
      </Link>
      <h1 className="text-3xl font-bold">Angebote</h1>

      {gespeichert && (
        <p className="rounded-lg bg-emerald-50 p-3 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">{gespeichert} Angebote gespeichert.</p>
      )}

      <Link href="/einkauf/angebote/einlesen" className={buttonPrimary}>
        📄 Prospekt einlesen
      </Link>

      <section className={`${card} flex flex-col gap-1`}>
        <h2 className="font-semibold">Prospekte der Märkte</h2>
        <p className="text-sm text-stone-500">Öffnen, PDF herunterladen oder Seiten fotografieren, dann oben einlesen.</p>
        <div className="mt-1 flex flex-wrap gap-2">
          {stores
            .filter((store) => store.flyer_url)
            .map((store) => (
              <a key={store.id} href={store.flyer_url!} target="_blank" rel="noopener noreferrer" className="rounded-full border border-stone-300 px-3 py-1.5 text-sm dark:border-stone-600">
                {store.name} ↗
              </a>
            ))}
        </div>
      </section>

      {offers.length === 0 && <p className="py-6 text-center text-stone-500">Noch keine aktuellen Angebote. Lies einen Prospekt ein.</p>}

      {highlighted.size > 0 && (
        <section className={card}>
          <h2 className="font-semibold">⭐ Passt zu dir</h2>
          <ul className="divide-y divide-stone-200 dark:divide-stone-700">
            {offers
              .filter((offer) => highlighted.has(offer.id))
              .map((offer) => (
                <OfferRow key={offer.id} offer={offer} today={today} reason={highlighted.get(offer.id)} />
              ))}
          </ul>
        </section>
      )}

      {byStore.map(({ store, offers: list }) => (
        <section key={store.id} className={card}>
          <h2 className="font-semibold">{store.name}</h2>
          <ul className="divide-y divide-stone-200 dark:divide-stone-700">
            {list.map((offer) => (
              <OfferRow key={offer.id} offer={offer} today={today} />
            ))}
          </ul>
        </section>
      ))}

      <p className="text-xs text-stone-500">Abgelaufene Angebote verschwinden automatisch. Bei Erdnuss-Verdacht immer die Packung lesen.</p>
    </div>
  );
}
