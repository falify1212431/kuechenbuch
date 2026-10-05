-- Phase 2: Scannen

-- Produkt-Gedächtnis: Jeder gescannte Barcode wird hier gemerkt (aus Open Food Facts oder
-- von der KI erkannt). Der nächste Scan desselben Barcodes klappt dann sofort.
create table public.products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  household_id uuid,
  barcode text not null check (barcode ~ '^[0-9]{8,14}$'),
  name text not null check (char_length(trim(name)) between 1 and 100),
  brand text,
  quantity numeric(10, 2) check (quantity is null or quantity > 0),
  unit text check (unit is null or unit in ('Stück', 'g', 'ml', 'Packung')),
  default_category_id uuid references public.categories (id) on delete set null,
  image_url text,
  -- Allergene laut Datenbank, z. B. {"en:peanuts"}; null = keine Angabe
  allergens text[],
  -- „Kann Spuren enthalten“, z. B. {"en:nuts"}; null = keine Angabe
  traces text[],
  ingredients_text text,
  -- Nährwerte pro 100 g bzw. 100 ml, z. B. {"kcal": 64, "fat": 3.5, ...}
  nutriments jsonb,
  source text not null check (source in ('off', 'ki', 'manuell')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, barcode)
);

-- Erdnuss-Warnung am Vorrats-Eintrag nur mit erlaubten Werten
alter table public.pantry_items
  add constraint pantry_items_allergen_warning_check
  check (allergen_warning is null or allergen_warning in ('erdnuss', 'spuren', 'ungeprueft'));

-- Zähler für das eigene KI-Tageslimit
create table public.ai_usage (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  count integer not null default 0 check (count >= 0),
  primary key (user_id, day)
);

alter table public.products enable row level security;
alter table public.ai_usage enable row level security;

create policy "Nur eigene Zeilen" on public.products for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Nur eigene Zeilen" on public.ai_usage for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.products, public.ai_usage to authenticated;

-- Zieht einen KI-Aufruf vom Tageslimit ab. Gibt true zurück, wenn noch etwas frei war.
-- Alles in einem Schritt, damit zwei gleichzeitige Aufrufe das Limit nicht überlisten.
create or replace function public.consume_ai_quota(day_limit integer)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  today date := (now() at time zone 'Europe/Berlin')::date;
  used integer;
begin
  if uid is null then
    raise exception 'Nicht angemeldet';
  end if;

  insert into public.ai_usage (user_id, day, count) values (uid, today, 1)
  on conflict (user_id, day) do update set count = public.ai_usage.count + 1
    where public.ai_usage.count < day_limit
  returning count into used;

  return used is not null;
end;
$$;

revoke execute on function public.consume_ai_quota(integer) from public, anon;
grant execute on function public.consume_ai_quota(integer) to authenticated;
