-- Wachhalten: Supabase Free legt Projekte nach einer Woche ohne Aktivität schlafen.
-- Ein täglicher Aufruf (Vercel Cron → /api/keepalive) ruft diese Funktion auf.
-- Sie liest keine Daten, sondern gibt nur die aktuelle Uhrzeit der Datenbank zurück.
create or replace function public.keepalive()
returns timestamptz
language sql
stable
security invoker
set search_path = ''
as $$
  select now();
$$;

grant execute on function public.keepalive() to anon, authenticated;
