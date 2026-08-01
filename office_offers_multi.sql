-- Standard-Multiplikatoren am Angebot. In Supabase -> SQL Editor ausfuehren (idempotent).
alter table public.office_offers add column if not exists def_mat_multi numeric default 1.28;
alter table public.office_offers add column if not exists def_lohn_multi numeric default 1.28;
