-- equipment_plan.sql
-- Tabelle für die Vorab-Planung im Modul "Fahrzeuge & Werkzeuge".
-- Einmalig im Supabase SQL-Editor ausführen.
-- Ein Eintrag = ein Gerät ist von date_from bis date_to für einen Mitarbeiter verplant.
-- Am Starttag wird der Plan beim Laden der Geräteliste automatisch zur echten Zuweisung
-- (Feld "activated"). Nach date_to wird die Zuweisung automatisch zurückgegeben und der
-- Plan geschlossen (Feld "closed").

create table if not exists public.equipment_plan (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null,
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  user_id      uuid,                 -- geplanter Mitarbeiter (company_users.user_id)
  user_name    text,                 -- Anzeigename (denormalisiert, für schnelle Anzeige)
  date_from    date not null,
  date_to      date not null,
  note         text,
  activated    boolean not null default false,  -- am Starttag übernommen?
  closed       boolean not null default false,  -- abgeschlossen (Ende vorbei / storniert)?
  created_by   text,
  created_at   timestamptz not null default now()
);

create index if not exists equipment_plan_company_idx   on public.equipment_plan (company_id);
create index if not exists equipment_plan_equipment_idx on public.equipment_plan (equipment_id);
create index if not exists equipment_plan_open_idx      on public.equipment_plan (company_id, closed, date_from);
