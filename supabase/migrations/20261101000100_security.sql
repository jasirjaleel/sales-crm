-- ==========================================
-- SECURITY: real roles and per-agent access
-- Agents see their own and unassigned leads. Admins see everything.
-- Invoices are admin only.
-- ==========================================

-- Live policies are not all recorded in this repo, and policies are OR'd together,
-- so any leftover permissive policy would undo this file. Start clean.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT tablename, policyname FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('profiles','lead_lists','leads','call_logs','follow_ups','whatsapp_templates','quotations','invoices')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- ------------------------------------------
-- Helpers
-- ------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT COALESCE((SELECT role = 'admin' FROM public.profiles WHERE id = auth.uid()), false);
$$;

CREATE OR REPLACE FUNCTION public.can_access_lead(p_lead_id BIGINT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT public.is_admin() OR EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id = p_lead_id AND (l.assigned_to = auth.uid() OR l.assigned_to IS NULL)
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_access_lead(BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_lead(BIGINT) TO authenticated;

-- Non-admins cannot change their own role or target. auth.uid() is NULL for the
-- dashboard SQL editor and service role, so those can still promote the first admin.
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    IF NEW.role IS DISTINCT FROM OLD.role
       OR NEW.daily_target IS DISTINCT FROM OLD.daily_target
       OR NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'Only an admin can change role or daily target' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_fields ON public.profiles;
CREATE TRIGGER protect_profile_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_fields();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'name', 'agent');
  RETURN NEW;
END;
$$;

-- ------------------------------------------
-- Ownership is set by the database, not the browser
-- ------------------------------------------
ALTER TABLE public.lead_lists ALTER COLUMN uploaded_by SET DEFAULT auth.uid();
ALTER TABLE public.call_logs ALTER COLUMN agent_id SET DEFAULT auth.uid();
ALTER TABLE public.follow_ups ALTER COLUMN agent_id SET DEFAULT auth.uid();
ALTER TABLE public.whatsapp_templates ALTER COLUMN created_by SET DEFAULT auth.uid();
ALTER TABLE public.quotations ALTER COLUMN created_by SET DEFAULT auth.uid();
ALTER TABLE public.invoices ALTER COLUMN created_by SET DEFAULT auth.uid();

-- ------------------------------------------
-- Policies
-- (SELECT public.is_admin()) is evaluated once per query rather than once per row.
-- ------------------------------------------

-- PROFILES
CREATE POLICY "Profiles readable by team" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Own profile can be created as agent" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() AND role = 'agent');
CREATE POLICY "Own profile or admin can update" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR (SELECT public.is_admin()))
  WITH CHECK (id = auth.uid() OR (SELECT public.is_admin()));

-- LEAD LISTS
CREATE POLICY "Lists readable by team" ON public.lead_lists FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage lists" ON public.lead_lists FOR ALL TO authenticated
  USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));

-- LEADS
CREATE POLICY "Own, unassigned or admin can read leads" ON public.leads FOR SELECT TO authenticated
  USING ((SELECT public.is_admin()) OR assigned_to = auth.uid() OR assigned_to IS NULL);
CREATE POLICY "Agents add leads for themselves" ON public.leads FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_admin()) OR assigned_to = auth.uid());
CREATE POLICY "Own, unassigned or admin can update leads" ON public.leads FOR UPDATE TO authenticated
  USING ((SELECT public.is_admin()) OR assigned_to = auth.uid() OR assigned_to IS NULL)
  WITH CHECK ((SELECT public.is_admin()) OR assigned_to = auth.uid() OR assigned_to IS NULL);
CREATE POLICY "Admins delete leads" ON public.leads FOR DELETE TO authenticated
  USING ((SELECT public.is_admin()));

-- CALL LOGS
CREATE POLICY "Read own calls or calls on accessible leads" ON public.call_logs FOR SELECT TO authenticated
  USING ((SELECT public.is_admin()) OR agent_id = auth.uid() OR public.can_access_lead(lead_id));
CREATE POLICY "Log own calls on accessible leads" ON public.call_logs FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_admin()) OR (agent_id = auth.uid() AND public.can_access_lead(lead_id)));
CREATE POLICY "Admins edit call logs" ON public.call_logs FOR UPDATE TO authenticated
  USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));
CREATE POLICY "Admins delete call logs" ON public.call_logs FOR DELETE TO authenticated
  USING ((SELECT public.is_admin()));

-- FOLLOW UPS
CREATE POLICY "Read own follow ups or those on accessible leads" ON public.follow_ups FOR SELECT TO authenticated
  USING ((SELECT public.is_admin()) OR agent_id = auth.uid() OR public.can_access_lead(lead_id));
CREATE POLICY "Create own follow ups on accessible leads" ON public.follow_ups FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_admin()) OR (agent_id = auth.uid() AND public.can_access_lead(lead_id)));
CREATE POLICY "Update own follow ups or those on accessible leads" ON public.follow_ups FOR UPDATE TO authenticated
  USING ((SELECT public.is_admin()) OR agent_id = auth.uid() OR public.can_access_lead(lead_id))
  WITH CHECK ((SELECT public.is_admin()) OR agent_id = auth.uid() OR public.can_access_lead(lead_id));
CREATE POLICY "Admins delete follow ups" ON public.follow_ups FOR DELETE TO authenticated
  USING ((SELECT public.is_admin()));

-- WHATSAPP TEMPLATES
CREATE POLICY "Templates readable by team" ON public.whatsapp_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Create own templates" ON public.whatsapp_templates FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_admin()) OR created_by = auth.uid());
CREATE POLICY "Author or admin can update templates" ON public.whatsapp_templates FOR UPDATE TO authenticated
  USING ((SELECT public.is_admin()) OR created_by = auth.uid())
  WITH CHECK ((SELECT public.is_admin()) OR created_by = auth.uid());
CREATE POLICY "Author or admin can delete templates" ON public.whatsapp_templates FOR DELETE TO authenticated
  USING ((SELECT public.is_admin()) OR created_by = auth.uid());

-- QUOTATIONS
CREATE POLICY "Read quotations on accessible leads" ON public.quotations FOR SELECT TO authenticated
  USING ((SELECT public.is_admin()) OR created_by = auth.uid() OR public.can_access_lead(lead_id));
CREATE POLICY "Create quotations on accessible leads" ON public.quotations FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_admin()) OR (created_by = auth.uid() AND public.can_access_lead(lead_id)));
CREATE POLICY "Update quotations on accessible leads" ON public.quotations FOR UPDATE TO authenticated
  USING ((SELECT public.is_admin()) OR created_by = auth.uid() OR public.can_access_lead(lead_id))
  WITH CHECK ((SELECT public.is_admin()) OR created_by = auth.uid() OR public.can_access_lead(lead_id));
CREATE POLICY "Admins or author delete quotations" ON public.quotations FOR DELETE TO authenticated
  USING ((SELECT public.is_admin()) OR created_by = auth.uid());

-- INVOICES
CREATE POLICY "Admins manage invoices" ON public.invoices FOR ALL TO authenticated
  USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));
