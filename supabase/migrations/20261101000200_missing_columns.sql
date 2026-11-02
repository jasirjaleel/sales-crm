-- ==========================================
-- Columns the app already uses but the database never had
-- ==========================================
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS website_status TEXT DEFAULT 'not_checked',
  ADD COLUMN IF NOT EXISTS website_notes TEXT,
  ADD COLUMN IF NOT EXISTS lost_reason TEXT;

ALTER TABLE public.lead_lists
  ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE public.follow_ups
  ADD COLUMN IF NOT EXISTS action_type TEXT DEFAULT 'call';

-- The app treats completed as true/false, the column was an integer.
-- '0' still filters correctly on a boolean, so a browser tab running the old app keeps working.
DO $$
BEGIN
  IF (SELECT data_type FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'follow_ups' AND column_name = 'completed') = 'integer' THEN
    ALTER TABLE public.follow_ups ALTER COLUMN completed DROP DEFAULT;
    ALTER TABLE public.follow_ups ALTER COLUMN completed TYPE BOOLEAN USING COALESCE(completed, 0) <> 0;
    ALTER TABLE public.follow_ups ALTER COLUMN completed SET DEFAULT false;
    ALTER TABLE public.follow_ups ALTER COLUMN completed SET NOT NULL;
  END IF;
END $$;

-- Duplicate follow-ups piled up because the clean-up query always errored.
-- Keep the newest open follow-up per lead and close the older ones.
UPDATE public.follow_ups f
SET completed = true
WHERE NOT f.completed
  AND EXISTS (
    SELECT 1 FROM public.follow_ups newer
    WHERE newer.lead_id = f.lead_id AND NOT newer.completed
      AND (newer.scheduled_at, newer.id) > (f.scheduled_at, f.id)
  );

-- The active WhatsApp template is shared by the team rather than stored per browser.
ALTER TABLE public.whatsapp_templates
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_templates_one_active
  ON public.whatsapp_templates (is_active) WHERE is_active;

-- Keep lead_lists.total_leads correct however leads are added or removed.
CREATE OR REPLACE FUNCTION public.refresh_list_totals()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.lead_lists ll
    SET total_leads = (SELECT count(*) FROM public.leads l WHERE l.list_id = ll.id)
    WHERE ll.id IN (SELECT list_id FROM new_rows WHERE list_id IS NOT NULL);
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.lead_lists ll
    SET total_leads = (SELECT count(*) FROM public.leads l WHERE l.list_id = ll.id)
    WHERE ll.id IN (SELECT list_id FROM old_rows WHERE list_id IS NOT NULL);
  ELSE
    -- Only leads that moved between lists: this fires on every lead update.
    UPDATE public.lead_lists ll
    SET total_leads = (SELECT count(*) FROM public.leads l WHERE l.list_id = ll.id)
    WHERE ll.id IN (
      SELECT unnest(ARRAY[o.list_id, n.list_id])
      FROM old_rows o JOIN new_rows n ON n.id = o.id
      WHERE o.list_id IS DISTINCT FROM n.list_id
    );
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS refresh_list_totals_insert ON public.leads;
DROP TRIGGER IF EXISTS refresh_list_totals_delete ON public.leads;
DROP TRIGGER IF EXISTS refresh_list_totals_update ON public.leads;
CREATE TRIGGER refresh_list_totals_insert AFTER INSERT ON public.leads
  REFERENCING NEW TABLE AS new_rows
  FOR EACH STATEMENT EXECUTE FUNCTION public.refresh_list_totals();
CREATE TRIGGER refresh_list_totals_delete AFTER DELETE ON public.leads
  REFERENCING OLD TABLE AS old_rows
  FOR EACH STATEMENT EXECUTE FUNCTION public.refresh_list_totals();
CREATE TRIGGER refresh_list_totals_update AFTER UPDATE ON public.leads
  REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows
  FOR EACH STATEMENT EXECUTE FUNCTION public.refresh_list_totals();

UPDATE public.lead_lists ll
SET total_leads = (SELECT count(*) FROM public.leads l WHERE l.list_id = ll.id);
