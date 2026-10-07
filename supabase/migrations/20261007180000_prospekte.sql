-- Phase 5: Prospekte & Angebote

-- PLZ oder Ort (Angebote sind regional verschieden). Wird vorerst nur gespeichert.
alter table public.preferences
  add column plz text check (plz is null or char_length(plz) <= 40);

-- Meine Märkte (Startwerte legt die App an: Aldi Süd, Lidl, Wasgau)
create table public.stores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  household_id uuid,
  name text not null check (char_length(trim(name)) between 1 and 40),
  -- Link zur Prospekt-Seite des Markts (zum Selbst-Herunterladen)
  flyer_url text check (flyer_url is null or flyer_url ~ '^https://'),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

-- Ein eingelesener Prospekt (die Fotos/PDFs selbst werden nicht gespeichert)
create table public.flyer_uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  household_id uuid,
  store_id uuid not null references public.stores (id) on delete cascade,
  pages integer not null check (pages between 1 and 100),
  created_at timestamptz not null default now()
);

-- Angebote aus Prospekten
create table public.offers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  household_id uuid,
  store_id uuid not null references public.stores (id) on delete cascade,
  product text not null check (char_length(trim(product)) between 1 and 120),
  brand text check (brand is null or char_length(brand) <= 80),
  price numeric(8, 2) not null check (price > 0),
  -- z. B. „1 kg = 3,98 €“
  unit_price text check (unit_price is null or char_length(unit_price) <= 60),
  -- z. B. „-30 %“
  discount text check (discount is null or char_length(discount) <= 40),
  valid_from date,
  valid_to date not null,
  flyer_upload_id uuid references public.flyer_uploads (id) on delete set null,
  created_at timestamptz not null default now(),
  check (valid_from is null or valid_from <= valid_to)
);

create index offers_user_valid_idx on public.offers (user_id, valid_to);

-- Einkaufsliste: Verweis auf das Angebot (Spalte gibt es seit Phase 1)
alter table public.shopping_items
  add constraint shopping_items_offer_id_fkey foreign key (offer_id) references public.offers (id) on delete set null;

alter table public.stores enable row level security;
alter table public.flyer_uploads enable row level security;
alter table public.offers enable row level security;

create policy "Nur eigene Zeilen" on public.stores for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Nur eigene Zeilen" on public.flyer_uploads for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Nur eigene Zeilen" on public.offers for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.stores, public.flyer_uploads, public.offers to authenticated;
