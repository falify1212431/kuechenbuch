-- Phase 1: Vorrat & Einkaufsliste
--
-- Jede Tabelle hat:
--   user_id      – wem die Zeile gehört (wird automatisch mit dem angemeldeten Nutzer gefüllt)
--   household_id – für später, falls ein Mitbewohner dazukommt (wird jetzt noch nicht genutzt)
-- Row Level Security (RLS): Jeder sieht und ändert nur seine eigenen Zeilen.

-- Lagerorte, z. B. Kühlschrank, Tiefkühler
create table public.locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  household_id uuid,
  name text not null check (char_length(trim(name)) between 1 and 60),
  icon text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

-- Kategorien, z. B. Obst, Milchprodukte & Eier
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  household_id uuid,
  name text not null check (char_length(trim(name)) between 1 and 60),
  icon text,
  -- typischer Lagerort, wird beim Anlegen eines Eintrags vorausgewählt
  default_location_id uuid references public.locations (id) on delete set null,
  -- Reihenfolge im Vorrat
  sort_order integer not null default 0,
  -- Reihenfolge im Laden (für die Einkaufsliste)
  aisle_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

-- Faustregeln für die Haltbarkeit. Eine Regel gilt für eine Kategorie, einen Lagerort
-- und/oder ein Schlagwort im Namen (z. B. "milch"). Die genaueste passende Regel gewinnt.
create table public.shelf_life_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  household_id uuid,
  category_id uuid references public.categories (id) on delete cascade,
  location_id uuid references public.locations (id) on delete cascade,
  keyword text check (keyword is null or keyword = lower(keyword)),
  -- Tage haltbar ab Einkauf (geschlossen), wenn kein Datum aufgedruckt ist
  days_closed integer check (days_closed is null or days_closed >= 0),
  -- Tage haltbar nach dem Öffnen
  days_opened integer check (days_opened is null or days_opened >= 0),
  created_at timestamptz not null default now(),
  check (category_id is not null or location_id is not null or keyword is not null)
);

-- Der Vorrat: alles, was zu Hause ist (und war)
create table public.pantry_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  household_id uuid,
  name text not null check (char_length(trim(name)) between 1 and 100),
  brand text,
  quantity numeric(10, 2) not null default 1 check (quantity >= 0),
  unit text not null default 'Stück' check (unit in ('Stück', 'g', 'ml', 'Packung')),
  category_id uuid references public.categories (id) on delete set null,
  location_id uuid references public.locations (id) on delete set null,
  -- aufgedrucktes oder geschätztes Datum
  date date,
  -- mhd = „Mindestens haltbar bis“, verbrauch = „Zu verbrauchen bis“
  date_type text not null default 'mhd' check (date_type in ('mhd', 'verbrauch')),
  date_estimated boolean not null default false,
  opened_at date,
  barcode text,
  photo_path text,
  status text not null default 'da' check (status in ('da', 'verbraucht', 'weggeworfen')),
  status_changed_at timestamptz,
  allergen_warning text,
  created_at timestamptz not null default now()
);

-- Die Einkaufsliste
create table public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  household_id uuid,
  name text not null check (char_length(trim(name)) between 1 and 100),
  quantity numeric(10, 2) not null default 1 check (quantity > 0),
  unit text not null default 'Stück' check (unit in ('Stück', 'g', 'ml', 'Packung')),
  category_id uuid references public.categories (id) on delete set null,
  checked boolean not null default false,
  source text not null default 'hand' check (source in ('hand', 'nachkaufen', 'plan', 'rezept', 'angebot')),
  -- Verweis auf ein Angebot (Tabelle kommt in Phase 5)
  offer_id uuid,
  created_at timestamptz not null default now()
);

create index locations_user_idx on public.locations (user_id);
create index categories_user_idx on public.categories (user_id);
create index shelf_life_rules_user_idx on public.shelf_life_rules (user_id);
create index pantry_items_user_status_idx on public.pantry_items (user_id, status);
create index shopping_items_user_idx on public.shopping_items (user_id);

-- Zeilenrechte: nur angemeldete Nutzer, nur eigene Zeilen
alter table public.locations enable row level security;
alter table public.categories enable row level security;
alter table public.shelf_life_rules enable row level security;
alter table public.pantry_items enable row level security;
alter table public.shopping_items enable row level security;

create policy "Nur eigene Zeilen" on public.locations for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Nur eigene Zeilen" on public.categories for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Nur eigene Zeilen" on public.shelf_life_rules for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Nur eigene Zeilen" on public.pantry_items for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Nur eigene Zeilen" on public.shopping_items for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.locations, public.categories, public.shelf_life_rules,
  public.pantry_items, public.shopping_items to authenticated;

-- Legt beim ersten Besuch die Startwerte aus der SPEC an: Lagerorte, Kategorien, Faustregeln.
-- Tut nichts, wenn schon Kategorien da sind. Läuft mit den Rechten des angemeldeten Nutzers.
create or replace function public.ensure_defaults()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  loc_kuehl uuid;
  loc_tk uuid;
  loc_vorrat uuid;
  loc_obst uuid;
  loc_brot uuid;
  cat_obst uuid;
  cat_gemuese uuid;
  cat_milch uuid;
  cat_fleisch uuid;
  cat_brot uuid;
  cat_nudeln uuid;
  cat_konserven uuid;
  cat_backen uuid;
  cat_gewuerze uuid;
  cat_tk uuid;
  cat_snacks uuid;
  cat_getraenke uuid;
begin
  if uid is null then
    raise exception 'Nicht angemeldet';
  end if;

  -- Verhindert, dass zwei gleichzeitige Aufrufe doppelt anlegen
  perform pg_advisory_xact_lock(hashtext(uid::text));

  if exists (select 1 from public.categories where user_id = uid) then
    return;
  end if;

  insert into public.locations (user_id, name, icon, sort_order) values (uid, 'Kühlschrank', '❄️', 1) returning id into loc_kuehl;
  insert into public.locations (user_id, name, icon, sort_order) values (uid, 'Tiefkühler', '🧊', 2) returning id into loc_tk;
  insert into public.locations (user_id, name, icon, sort_order) values (uid, 'Vorratsschrank', '🗄️', 3) returning id into loc_vorrat;
  insert into public.locations (user_id, name, icon, sort_order) values (uid, 'Obstschale', '🧺', 4) returning id into loc_obst;
  insert into public.locations (user_id, name, icon, sort_order) values (uid, 'Brotkasten', '🍞', 5) returning id into loc_brot;

  -- sort_order = Reihenfolge im Vorrat, aisle_order = typischer Weg durch den Laden
  insert into public.categories (user_id, name, icon, sort_order, aisle_order, default_location_id)
    values (uid, 'Obst', '🍎', 1, 1, loc_obst) returning id into cat_obst;
  insert into public.categories (user_id, name, icon, sort_order, aisle_order, default_location_id)
    values (uid, 'Gemüse & Salat', '🥬', 2, 2, loc_kuehl) returning id into cat_gemuese;
  insert into public.categories (user_id, name, icon, sort_order, aisle_order, default_location_id)
    values (uid, 'Milchprodukte & Eier', '🥛', 3, 4, loc_kuehl) returning id into cat_milch;
  insert into public.categories (user_id, name, icon, sort_order, aisle_order, default_location_id)
    values (uid, 'Fleisch, Fisch & Ersatz', '🍗', 4, 5, loc_kuehl) returning id into cat_fleisch;
  insert into public.categories (user_id, name, icon, sort_order, aisle_order, default_location_id)
    values (uid, 'Brot & Backwaren', '🥖', 5, 3, loc_brot) returning id into cat_brot;
  insert into public.categories (user_id, name, icon, sort_order, aisle_order, default_location_id)
    values (uid, 'Nudeln, Reis & Getreide', '🍝', 6, 6, loc_vorrat) returning id into cat_nudeln;
  insert into public.categories (user_id, name, icon, sort_order, aisle_order, default_location_id)
    values (uid, 'Konserven & Saucen', '🥫', 7, 7, loc_vorrat) returning id into cat_konserven;
  insert into public.categories (user_id, name, icon, sort_order, aisle_order, default_location_id)
    values (uid, 'Backen & Grundzutaten', '🌾', 8, 8, loc_vorrat) returning id into cat_backen;
  insert into public.categories (user_id, name, icon, sort_order, aisle_order, default_location_id)
    values (uid, 'Gewürze & Würzmittel', '🧂', 9, 9, loc_vorrat) returning id into cat_gewuerze;
  insert into public.categories (user_id, name, icon, sort_order, aisle_order, default_location_id)
    values (uid, 'Tiefkühlware', '🧊', 10, 12, loc_tk) returning id into cat_tk;
  insert into public.categories (user_id, name, icon, sort_order, aisle_order, default_location_id)
    values (uid, 'Snacks & Süßes', '🍫', 11, 10, loc_vorrat) returning id into cat_snacks;
  insert into public.categories (user_id, name, icon, sort_order, aisle_order, default_location_id)
    values (uid, 'Getränke', '🧃', 12, 11, loc_vorrat) returning id into cat_getraenke;

  insert into public.shelf_life_rules (user_id, category_id, location_id, keyword, days_closed, days_opened) values
    -- nach Kategorie (grobe Faustregel)
    (uid, cat_obst, null, null, 7, null),
    (uid, cat_gemuese, null, null, 5, null),
    (uid, cat_milch, null, null, 10, 4),
    (uid, cat_fleisch, null, null, 2, 1),
    (uid, cat_brot, null, null, 4, null),
    (uid, cat_nudeln, null, null, 365, 180),
    (uid, cat_konserven, null, null, 365, 4),
    (uid, cat_backen, null, null, 365, 180),
    (uid, cat_gewuerze, null, null, 365, 180),
    (uid, cat_tk, null, null, 90, null),
    (uid, cat_snacks, null, null, 90, 14),
    (uid, cat_getraenke, null, null, 180, 4),
    -- nach Lagerort: Eingefrorenes hält lange, egal was es ist
    (uid, null, loc_tk, null, 90, null),
    -- nach Schlagwort im Namen (genauer als die Kategorie)
    (uid, null, null, 'h-milch', 90, 3),
    (uid, null, null, 'milch', 7, 3),
    (uid, null, null, 'buttermilch', 10, 3),
    (uid, null, null, 'joghurt', 14, 4),
    (uid, null, null, 'sahne', 10, 3),
    (uid, null, null, 'quark', 14, 4),
    (uid, null, null, 'butter', 30, 21),
    (uid, null, null, 'käse', 21, 10),
    (uid, null, null, 'eier', 21, null),
    (uid, null, null, 'hack', 1, null),
    (uid, null, null, 'hähnchen', 2, null),
    (uid, null, null, 'geflügel', 2, null),
    (uid, null, null, 'lachs', 2, null),
    (uid, null, null, 'fisch', 2, null),
    (uid, null, null, 'tofu', 30, 4),
    (uid, null, null, 'passierte tomaten', 365, 4),
    (uid, null, null, 'tomatenmark', 365, 14),
    (uid, null, null, 'kichererbsen', 365, 3),
    (uid, null, null, 'toast', 7, null),
    (uid, null, null, 'brötchen', 2, null),
    (uid, null, null, 'banane', 5, null),
    (uid, null, null, 'beeren', 3, null),
    (uid, null, null, 'apfel', 21, null),
    (uid, null, null, 'äpfel', 21, null),
    (uid, null, null, 'salat', 4, null),
    (uid, null, null, 'spinat', 3, null),
    (uid, null, null, 'zwiebel', 30, null),
    (uid, null, null, 'kartoffel', 30, null),
    (uid, null, null, 'paprika', 7, null),
    (uid, null, null, 'tomate', 7, null),
    (uid, null, null, 'saft', 180, 4);
end;
$$;

revoke execute on function public.ensure_defaults() from public, anon;
grant execute on function public.ensure_defaults() to authenticated;
