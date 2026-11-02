-- ==========================================
-- Owner summary, payment dates, and the AI assistant's usage limit
-- ==========================================

-- When an invoice was paid, so revenue can be reported by month.
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE;
UPDATE public.invoices SET paid_at = created_at WHERE status = 'Paid' AND paid_at IS NULL;

CREATE OR REPLACE FUNCTION public.set_invoice_paid_at()
RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'Paid' THEN
    NEW.paid_at := COALESCE(NEW.paid_at, CURRENT_TIMESTAMP);
  ELSE
    NEW.paid_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_invoice_paid_at ON public.invoices;
CREATE TRIGGER set_invoice_paid_at BEFORE INSERT OR UPDATE OF status ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_invoice_paid_at();

-- The single view of the business. Admin only.
-- Forecast weights are planning assumptions, shown as such on the page.
CREATE OR REPLACE FUNCTION public.owner_summary(p_tz TEXT DEFAULT 'Asia/Kolkata')
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  v_month_start TIMESTAMPTZ := date_trunc('month', now() AT TIME ZONE p_tz) AT TIME ZONE p_tz;
  v_today DATE := (now() AT TIME ZONE p_tz)::date;
  v_result JSONB;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin only' USING ERRCODE = '42501';
  END IF;

  WITH open_deals AS (
    SELECT l.*, COALESCE(l.deal_value, 0) AS value,
      (v_today - (GREATEST(l.last_called_at, l.stage_changed_at) AT TIME ZONE p_tz)::date) AS days_idle
    FROM public.leads l
    WHERE l.status IN ('contacted', 'interested', 'meeting_booked', 'proposal_sent')
  ),
  risky AS (
    SELECT d.id, d.name, d.status AS stage, d.value AS deal_value, p.name AS owner, d.days_idle,
      CASE WHEN d.expected_close_date < v_today THEN 'Past expected close date'
           ELSE 'No activity for ' || d.days_idle || ' days' END AS reason
    FROM open_deals d
    LEFT JOIN public.profiles p ON p.id = d.assigned_to
    WHERE d.status <> 'contacted'
      AND (d.days_idle >= 7 OR d.expected_close_date < v_today)
  ),
  outcomes AS (
    SELECT count(*) FILTER (WHERE status = 'won') AS won,
           count(*) FILTER (WHERE status = 'lost') AS lost
    FROM public.leads
  ),
  money AS (
    SELECT
      COALESCE(sum(amount - COALESCE(discount, 0)) FILTER (WHERE status = 'Paid' AND paid_at >= v_month_start), 0) AS collected_month,
      COALESCE(sum(amount - COALESCE(discount, 0)) FILTER (WHERE status NOT IN ('Paid', 'Cancelled')), 0) AS outstanding,
      COALESCE(sum(amount - COALESCE(discount, 0)) FILTER (WHERE status NOT IN ('Paid', 'Cancelled') AND due_date < v_today), 0) AS overdue
    FROM public.invoices
  )
  SELECT jsonb_build_object(
    'pipelineValue', (SELECT COALESCE(sum(value), 0) FROM open_deals),
    'forecast', (SELECT COALESCE(sum(value * CASE status
        WHEN 'contacted' THEN 0.10 WHEN 'interested' THEN 0.25
        WHEN 'meeting_booked' THEN 0.50 WHEN 'proposal_sent' THEN 0.75 END), 0) FROM open_deals),
    'openDeals', (SELECT count(*) FROM open_deals WHERE value > 0),
    'won', (SELECT won FROM outcomes),
    'lost', (SELECT lost FROM outcomes),
    'winRate', (SELECT CASE WHEN won + lost > 0 THEN round(100.0 * won / (won + lost)) END FROM outcomes),
    'collectedThisMonth', (SELECT collected_month FROM money),
    'outstanding', (SELECT outstanding FROM money),
    'overdue', (SELECT overdue FROM money),
    'atRiskCount', (SELECT count(*) FROM risky),
    'atRiskValue', (SELECT COALESCE(sum(deal_value), 0) FROM risky),
    'atRisk', COALESCE((
      SELECT jsonb_agg(to_jsonb(t)) FROM (
        SELECT * FROM risky ORDER BY deal_value DESC, days_idle DESC LIMIT 8
      ) t), '[]'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.owner_summary(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_summary(TEXT) TO authenticated;

-- Each AI request costs money, so every person gets a daily allowance.
CREATE TABLE IF NOT EXISTS public.ai_usage (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day DATE NOT NULL DEFAULT CURRENT_DATE,
  requests INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);
-- RLS on with no policies: only the function below can touch this table.
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.consume_ai_quota(p_daily_limit INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_used INTEGER;
BEGIN
  INSERT INTO public.ai_usage (user_id, requests) VALUES (auth.uid(), 1)
  ON CONFLICT (user_id, day) DO UPDATE SET requests = public.ai_usage.requests + 1
  RETURNING requests INTO v_used;
  RETURN v_used <= p_daily_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_ai_quota(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_ai_quota(INTEGER) TO authenticated;
