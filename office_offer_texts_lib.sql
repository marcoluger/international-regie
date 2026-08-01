-- Textbausteine (mehrere Vor-/Nachtexte). Idempotent, in Supabase ausfuehren.
create table if not exists public.office_offer_texts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  kind text not null,
  title text,
  body text,
  created_at timestamptz not null default now()
);
create index if not exists office_offer_texts_company_idx on public.office_offer_texts(company_id);
alter table public.office_offer_texts enable row level security;
drop policy if exists office_offer_texts_rw on public.office_offer_texts;
create policy office_offer_texts_rw on public.office_offer_texts for all
  using (exists (select 1 from public.company_users cu where cu.user_id = auth.uid() and cu.company_id = office_offer_texts.company_id and cu.role in ('owner','admin')))
  with check (exists (select 1 from public.company_users cu where cu.user_id = auth.uid() and cu.company_id = office_offer_texts.company_id and cu.role in ('owner','admin')));
