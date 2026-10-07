-- Phase 3: Vorlieben & Kochen mit KI

-- Meine Vorlieben: genau eine Zeile pro Nutzer. Die Startwerte („Meine Angaben“ aus der SPEC)
-- legt die App beim ersten Besuch an (lib/cooking/preferences.ts).
create table public.preferences (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  household_id uuid,
  diet text not null default 'alles'
    check (diet in ('alles', 'vegetarisch', 'vegan', 'pescetarisch', 'flexitarisch')),
  -- Freitext zur Ernährung, z. B. „möglichst naturbelassen“
  diet_notes text not null default '' check (char_length(diet_notes) <= 500),
  -- Allergien: werden immer hart ausgeschlossen (Erdnuss ist zusätzlich fest im Code gesperrt)
  allergies text[] not null default '{}',
  -- Mag ich nicht: kommt nie in Vorschlägen vor
  dislikes text[] not null default '{}',
  cuisines text[] not null default '{}',
  goals text[] not null default '{}',
  servings integer not null default 2 check (servings between 1 and 12),
  max_minutes_weekday integer not null default 30 check (max_minutes_weekday between 5 and 300),
  max_minutes_weekend integer not null default 60 check (max_minutes_weekend between 5 and 300),
  budget_week numeric(7, 2) check (budget_week is null or budget_week >= 0),
  appliances text[] not null default '{}',
  -- Grundvorrat: gilt immer als vorhanden (Salz, Pfeffer, Öl …)
  staples text[] not null default '{}',
  updated_at timestamptz not null default now()
);

-- Rezepte: KI-Vorschläge, gemerkte Favoriten und bewertete Gerichte.
-- Vorschläge werden gleich hier gespeichert, damit Zurück-Taste und Koch-Modus keine neue
-- KI-Anfrage brauchen. Unbenutzte Vorschläge räumt die App nach 7 Tagen wieder weg.
create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  household_id uuid,
  title text not null check (char_length(trim(title)) between 1 and 120),
  summary text,
  servings integer not null check (servings between 1 and 20),
  minutes integer not null check (minutes between 1 and 600),
  difficulty text not null check (difficulty in ('leicht', 'mittel', 'schwer')),
  -- [{ name, amount, unit, pantryItemId, staple }]
  ingredients jsonb not null,
  -- [{ text, timerMinutes }]
  steps jsonb not null,
  -- { days, storage, reheat } oder null
  meal_prep jsonb,
  source text not null default 'ki' check (source in ('ki', 'manuell')),
  -- Daumen: 1 = hoch, -1 = runter, null = nicht bewertet
  rating smallint check (rating in (-1, 1)),
  favorite boolean not null default false,
  cooked_count integer not null default 0 check (cooked_count >= 0),
  last_cooked_at timestamptz,
  -- Wann und an welcher Stelle die KI das Rezept vorgeschlagen hat (für die Ergebnisliste)
  suggested_at timestamptz,
  suggestion_rank smallint,
  created_at timestamptz not null default now()
);

create index recipes_user_suggested_idx on public.recipes (user_id, suggested_at desc);

alter table public.preferences enable row level security;
alter table public.recipes enable row level security;

create policy "Nur eigene Zeilen" on public.preferences for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Nur eigene Zeilen" on public.recipes for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.preferences, public.recipes to authenticated;
