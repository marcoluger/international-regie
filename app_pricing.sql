-- app_pricing.sql
-- Zentrale Speicherung des Preis-Modells (Preis-Rechner im Admin).
-- Einmalig im Supabase SQL-Editor ausführen.
-- Eine Zeile (id = 'main'); config enthält seatTiers, perLanguage und modules als JSON.

create table if not exists public.app_pricing (
  id         text primary key,
  config     jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
