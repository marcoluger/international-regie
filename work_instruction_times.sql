-- ============================================================
-- Regie International – Arbeitsanweisung: Umfang (Tag/Woche)
-- + vom Mitarbeiter erfasste Zeiten (Stunden, Pause, Fahrzeit, km)
-- In Supabase → SQL Editor einfügen und ausführen.
-- ============================================================

-- 1) Umfang der Arbeitsanweisung: 'day' (ein Tag) oder 'week' (ganze Woche)
alter table work_instructions
  add column if not exists scope text not null default 'day';

-- 2) Zeiten je Mitarbeiter, je Arbeitsanweisung, je Tag
create table if not exists work_instruction_times (
  id uuid primary key default gen_random_uuid(),
  work_instruction_id uuid not null references work_instructions(id) on delete cascade,
  company_id uuid,
  user_id uuid not null,
  work_date date not null,
  start_time text,
  end_time text,
  break_minutes text,
  hours text,
  travel_out_start text,
  travel_out_end text,
  travel_out_km text,
  travel_return_start text,
  travel_return_end text,
  travel_return_km text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- ein Eintrag pro Mitarbeiter/Anweisung/Tag (Upsert)
  unique (work_instruction_id, user_id, work_date)
);

create index if not exists idx_wit_company on work_instruction_times (company_id);
create index if not exists idx_wit_user on work_instruction_times (user_id);
create index if not exists idx_wit_instruction on work_instruction_times (work_instruction_id);
