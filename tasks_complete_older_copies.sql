-- tasks_complete_older_copies.sql
-- Einmalige Bereinigung: Arbeitsschritte, die im selben Projekt an einem SPAETEREN
-- (oder gleichen) Tag bereits als "Erledigt" existieren (gleicher Text, entstanden
-- durch "Schritte uebernehmen"), werden auch in den aelteren Anweisungen auf
-- "Erledigt" gesetzt. Kann gefahrlos mehrfach ausgefuehrt werden.
--
-- SCHRITT 1 (nur ansehen): Wie viele Schritte waeren betroffen?
select count(*) as betroffen
from public.work_instruction_tasks t
join public.work_instructions wi on wi.id = t.work_instruction_id
where coalesce(t.status, 'open') <> 'completed'
  and trim(coalesce(t.task_text, '')) <> ''
  and wi.work_date is not null
  and exists (
    select 1
    from public.work_instruction_tasks t2
    join public.work_instructions wi2 on wi2.id = t2.work_instruction_id
    where t2.status = 'completed'
      and wi2.id <> wi.id
      and wi2.company_id = wi.company_id
      and wi2.work_date is not null
      and wi2.work_date >= wi.work_date
      and ((wi.project_id is not null and wi2.project_id = wi.project_id)
        or (wi.project_id is null and trim(coalesce(wi.project, '')) <> '' and wi2.project = wi.project))
      and lower(regexp_replace(trim(t2.task_text), '\s+', ' ', 'g'))
        = lower(regexp_replace(trim(t.task_text),  '\s+', ' ', 'g'))
  );

-- SCHRITT 2 (ausfuehren): dieselben Schritte auf "Erledigt" setzen.
update public.work_instruction_tasks t
set status = 'completed'
from public.work_instructions wi
where wi.id = t.work_instruction_id
  and coalesce(t.status, 'open') <> 'completed'
  and trim(coalesce(t.task_text, '')) <> ''
  and wi.work_date is not null
  and exists (
    select 1
    from public.work_instruction_tasks t2
    join public.work_instructions wi2 on wi2.id = t2.work_instruction_id
    where t2.status = 'completed'
      and wi2.id <> wi.id
      and wi2.company_id = wi.company_id
      and wi2.work_date is not null
      and wi2.work_date >= wi.work_date
      and ((wi.project_id is not null and wi2.project_id = wi.project_id)
        or (wi.project_id is null and trim(coalesce(wi.project, '')) <> '' and wi2.project = wi.project))
      and lower(regexp_replace(trim(t2.task_text), '\s+', ' ', 'g'))
        = lower(regexp_replace(trim(t.task_text),  '\s+', ' ', 'g'))
  );
