-- tasks_readonly_policy.sql
-- Zweck: Konten mit "Nur lesen" duerfen Arbeitsschritte nicht mehr aendern/anlegen/loeschen.
-- Lesen bleibt unveraendert moeglich (Policy "Users can read work instruction tasks", SELECT).
-- Idempotent: kann mehrfach ausgefuehrt werden.
--
-- Der Ausdruck ist wortgleich uebernommen; ergaenzt wurde ausschliesslich
--   AND NOT COALESCE(company_users.read_only, false)

DROP POLICY IF EXISTS "Users can manage work instruction tasks"
  ON public.work_instruction_tasks;

CREATE POLICY "Users can manage work instruction tasks"
  ON public.work_instruction_tasks
  FOR ALL
  USING (
    work_instruction_id IN (
      SELECT work_instructions.id
      FROM work_instructions
      WHERE work_instructions.company_id IN (
        SELECT company_users.company_id
        FROM company_users
        WHERE company_users.user_id = auth.uid()
          AND company_users.role = ANY (ARRAY['owner'::text, 'admin'::text, 'project_manager'::text, 'employee'::text])
          AND NOT COALESCE(company_users.read_only, false)
      )
    )
  )
  WITH CHECK (
    work_instruction_id IN (
      SELECT work_instructions.id
      FROM work_instructions
      WHERE work_instructions.company_id IN (
        SELECT company_users.company_id
        FROM company_users
        WHERE company_users.user_id = auth.uid()
          AND company_users.role = ANY (ARRAY['owner'::text, 'admin'::text, 'project_manager'::text, 'employee'::text])
          AND NOT COALESCE(company_users.read_only, false)
      )
    )
  );

-- Kontrolle: es muessen weiterhin GENAU zwei Policies existieren
-- ("... manage ..." = ALL, "... read ..." = SELECT).
select polname,
       case polcmd when 'r' then 'SELECT' when 'a' then 'INSERT'
                   when 'w' then 'UPDATE' when 'd' then 'DELETE'
                   else 'ALL' end as cmd
from pg_policy
where polrelid = 'public.work_instruction_tasks'::regclass
order by polname;
