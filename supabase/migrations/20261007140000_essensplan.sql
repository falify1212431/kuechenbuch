-- Phase 4: Essensplan

-- Welche Mahlzeiten geplant werden (Absprache 07.10.2026: nur Abendessen als Hauptgericht)
alter table public.preferences
  add column meal_slots text[] not null default '{abend}'
    check (cardinality(meal_slots) >= 1 and meal_slots <@ array['mittag', 'abend']::text[]);

-- Der Wochenplan: pro Tag und Mahlzeit höchstens ein Eintrag.
-- Ein Eintrag ist entweder ein Rezept, freier Text, Reste eines Rezepts oder „frei / auswärts“.
create table public.meal_plan (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  household_id uuid,
  date date not null,
  slot text not null check (slot in ('mittag', 'abend')),
  -- Wird das Rezept gelöscht, verschwindet auch der Plan-Eintrag
  recipe_id uuid references public.recipes (id) on delete cascade,
  free_text text check (free_text is null or char_length(trim(free_text)) between 1 and 120),
  -- Meal-Prep: „Reste vom Curry“ – zeigt auf das Rezept, das vorher gekocht wurde
  leftovers_recipe_id uuid references public.recipes (id) on delete cascade,
  -- „frei / auswärts“: hier plant die KI nichts
  skip boolean not null default false,
  cooked boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, date, slot),
  check (num_nonnulls(recipe_id, free_text, leftovers_recipe_id) + skip::int = 1)
);

create index meal_plan_user_date_idx on public.meal_plan (user_id, date);

alter table public.meal_plan enable row level security;

create policy "Nur eigene Zeilen" on public.meal_plan for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.meal_plan to authenticated;
