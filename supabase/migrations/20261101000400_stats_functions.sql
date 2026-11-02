-- ==========================================
-- Numbers calculated in the database, so they stay correct past the
-- 1000-row API limit. SECURITY INVOKER: table policies still apply.
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_call_logs_called_at ON public.call_logs(called_at);
CREATE INDEX IF NOT EXISTS idx_call_logs_agent_called ON public.call_logs(agent_id, called_at);
CREATE INDEX IF NOT EXISTS idx_call_logs_lead ON public.call_logs(lead_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_agent_open ON public.follow_ups(agent_id, scheduled_at) WHERE NOT completed;
CREATE INDEX IF NOT EXISTS idx_follow_ups_lead ON public.follow_ups(lead_id);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_status ON public.leads(assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_leads_list ON public.leads(list_id);
CREATE INDEX IF NOT EXISTS idx_leads_phone ON public.leads(phone);
CREATE INDEX IF NOT EXISTS idx_leads_stage_changed ON public.leads(stage_changed_at DESC);

-- Team stats used by the dashboard. An admin in agent view gets their own numbers.
CREATE OR REPLACE FUNCTION public.dashboard_stats(p_tz TEXT DEFAULT 'Asia/Kolkata', p_view TEXT DEFAULT 'admin')
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_all BOOLEAN := public.is_admin() AND p_view = 'admin';
  v_today DATE := (now() AT TIME ZONE p_tz)::date;
  v_today_start TIMESTAMPTZ := v_today::timestamp AT TIME ZONE p_tz;
  v_result JSONB;
BEGIN
  WITH logs AS (
    SELECT agent_id, (called_at AT TIME ZONE p_tz)::date AS day
    FROM public.call_logs
    WHERE called_at >= ((v_today - 13)::timestamp AT TIME ZONE p_tz)
  ),
  my_logs AS (
    SELECT * FROM logs WHERE v_all OR agent_id = v_uid
  ),
  chart AS (
    SELECT d::date AS day, (SELECT count(*) FROM my_logs m WHERE m.day = d::date) AS calls
    FROM generate_series(v_today - 13, v_today, INTERVAL '1 day') d
  ),
  team AS (
    SELECT
      p.id, COALESCE(p.name, 'User') AS name, COALESCE(p.daily_target, 30) AS target,
      (SELECT count(*) FROM public.call_logs c
        WHERE c.agent_id = p.id AND c.called_at >= v_today_start) AS completed,
      count(l.id) AS assigned,
      count(l.id) FILTER (WHERE l.phone IS NULL OR l.phone = '') AS missing_phone,
      count(l.id) FILTER (WHERE l.phone IS NOT NULL AND l.phone <> '' AND l.status = 'new') AS callable,
      count(l.id) FILTER (WHERE l.status = 'interested') AS interested,
      count(l.id) FILTER (WHERE l.status = 'meeting_booked') AS meetings
    FROM public.profiles p
    LEFT JOIN public.leads l ON l.assigned_to = p.id
    WHERE public.is_admin() OR p.id = v_uid
    GROUP BY p.id
  )
  SELECT jsonb_build_object(
    'followUps', (
      SELECT jsonb_build_object(
        'dueNow', count(*) FILTER (WHERE f.scheduled_at <= now() AND now() <= f.scheduled_at + INTERVAL '5 hours'),
        'overdue', count(*) FILTER (WHERE now() > f.scheduled_at + INTERVAL '5 hours'))
      FROM public.follow_ups f
      WHERE NOT f.completed AND (v_all OR f.agent_id = v_uid)),
    'lists', (
      SELECT jsonb_build_object('count', count(*), 'totalLeads', COALESCE(sum(total_leads), 0))
      FROM public.lead_lists),
    'totalAvailable', (SELECT count(*) FROM public.leads WHERE status = 'new' AND assigned_to IS NULL),
    'quotationsPending', (SELECT count(*) FROM public.quotations WHERE status IN ('Draft', 'Sent')),
    'today', (SELECT count(*) FROM my_logs WHERE day = v_today),
    'yesterday', (SELECT count(*) FROM my_logs WHERE day = v_today - 1),
    'chart', (SELECT jsonb_agg(jsonb_build_object('rawDate', day, 'calls', calls) ORDER BY day) FROM chart),
    'team', COALESCE((SELECT jsonb_agg(to_jsonb(team) ORDER BY team.name) FROM team), '[]'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END;
$$;

-- Lists with assignment counts, for the campaign and queue pages.
CREATE OR REPLACE FUNCTION public.lead_list_stats()
RETURNS TABLE (
  id BIGINT, name TEXT, category TEXT, created_at TIMESTAMPTZ,
  total_leads BIGINT, assigned_leads BIGINT, unassigned_leads BIGINT, pool_leads BIGINT
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$
  SELECT ll.id, ll.name, ll.category, ll.created_at,
    count(l.id),
    count(l.id) FILTER (WHERE l.assigned_to IS NOT NULL),
    count(l.id) FILTER (WHERE l.assigned_to IS NULL),
    count(l.id) FILTER (WHERE l.assigned_to IS NULL AND l.status = 'new')
  FROM public.lead_lists ll
  LEFT JOIN public.leads l ON l.list_id = ll.id
  GROUP BY ll.id
  ORDER BY ll.created_at DESC;
$$;

-- Queue Manager numbers. Admin only.
CREATE OR REPLACE FUNCTION public.queue_stats()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = ''
AS $$
DECLARE v_result JSONB;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin only' USING ERRCODE = '42501';
  END IF;
  WITH team AS (
    SELECT p.id, COALESCE(p.name, 'User') AS name, COALESCE(p.daily_target, 30) AS target,
      count(l.id) AS assigned,
      count(l.id) FILTER (WHERE l.status <> 'new') AS completed,
      GREATEST(0, COALESCE(p.daily_target, 30) - count(l.id) FILTER (WHERE l.status <> 'new')) AS remaining
    FROM public.profiles p
    LEFT JOIN public.leads l ON l.assigned_to = p.id
    GROUP BY p.id
  )
  SELECT jsonb_build_object(
    'totalAvailable', (SELECT count(*) FROM public.leads WHERE status = 'new' AND assigned_to IS NULL),
    'teamTarget', (SELECT COALESCE(sum(target), 0) FROM team),
    'teamCompleted', (SELECT COALESCE(sum(completed), 0) FROM team),
    'team', COALESCE((SELECT jsonb_agg(to_jsonb(team) ORDER BY team.name) FROM team), '[]'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END;
$$;

-- Top each person's queue up to their daily target with the best uncalled leads.
CREATE OR REPLACE FUNCTION public.assign_leads(p_list_id BIGINT DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  r RECORD;
  v_count INTEGER;
  v_total INTEGER := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin only' USING ERRCODE = '42501';
  END IF;
  FOR r IN
    SELECT p.id, COALESCE(p.daily_target, 30) - count(l.id) AS needed
    FROM public.profiles p
    LEFT JOIN public.leads l ON l.assigned_to = p.id AND l.status = 'new'
    GROUP BY p.id
    ORDER BY p.name
  LOOP
    IF r.needed > 0 THEN
      UPDATE public.leads SET assigned_to = r.id, assigned_date = now()
      WHERE id IN (
        SELECT l.id FROM public.leads l
        WHERE l.assigned_to IS NULL AND l.status = 'new'
          AND (p_list_id IS NULL OR l.list_id = p_list_id)
        ORDER BY l.ai_score DESC NULLS LAST, l.id
        LIMIT r.needed
        FOR UPDATE SKIP LOCKED
      );
      GET DIAGNOSTICS v_count = ROW_COUNT;
      v_total := v_total + v_count;
    END IF;
  END LOOP;
  RETURN v_total;
END;
$$;

-- Count and value per stage for kanban column headers. Policies scope it per user.
CREATE OR REPLACE FUNCTION public.pipeline_totals(p_list_id BIGINT DEFAULT NULL, p_assigned_to UUID DEFAULT NULL)
RETURNS TABLE (stage TEXT, lead_count BIGINT, total_value NUMERIC)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$
  SELECT l.status, count(*), COALESCE(sum(l.deal_value), 0)
  FROM public.leads l
  WHERE (p_list_id IS NULL OR l.list_id = p_list_id)
    AND (p_assigned_to IS NULL OR l.assigned_to = p_assigned_to)
  GROUP BY l.status;
$$;

-- Reports page. Admin only.
CREATE OR REPLACE FUNCTION public.pipeline_report(p_days INTEGER DEFAULT 30)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  v_since TIMESTAMPTZ := now() - make_interval(days => p_days);
  v_result JSONB;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin only' USING ERRCODE = '42501';
  END IF;
  WITH best AS (
    -- The furthest stage each lead has reached, including leads later lost.
    SELECT l.id, l.status, l.assigned_to, l.deal_value, l.lost_reason,
      GREATEST(public.stage_rank(l.status),
        COALESCE((SELECT max(public.stage_rank(e.to_stage)) FROM public.lead_stage_events e WHERE e.lead_id = l.id), 0),
        CASE WHEN l.status = 'lost' OR l.last_outcome IS NOT NULL THEN 1 ELSE 0 END) AS reached
    FROM public.leads l
  ),
  funnel AS (
    SELECT s.stage, s.rank, count(b.id) FILTER (WHERE b.reached >= s.rank) AS leads
    FROM (VALUES ('new', 0), ('contacted', 1), ('interested', 2), ('meeting_booked', 3), ('proposal_sent', 4), ('won', 5)) AS s(stage, rank)
    CROSS JOIN best b
    GROUP BY s.stage, s.rank
  ),
  agents AS (
    SELECT p.id, COALESCE(p.name, 'User') AS name,
      (SELECT count(*) FROM public.call_logs c WHERE c.agent_id = p.id AND c.called_at >= v_since) AS calls,
      count(b.id) AS assigned,
      count(b.id) FILTER (WHERE b.reached >= 2) AS interested,
      count(b.id) FILTER (WHERE b.reached >= 3) AS meetings,
      count(b.id) FILTER (WHERE b.status = 'won') AS won,
      count(b.id) FILTER (WHERE b.status = 'lost') AS lost,
      COALESCE(sum(b.deal_value) FILTER (WHERE b.status = 'won'), 0) AS won_value
    FROM public.profiles p
    LEFT JOIN best b ON b.assigned_to = p.id
    GROUP BY p.id
  )
  SELECT jsonb_build_object(
    'days', p_days,
    'funnel', COALESCE((SELECT jsonb_agg(jsonb_build_object('stage', stage, 'leads', leads) ORDER BY rank) FROM funnel), '[]'::jsonb),
    'agents', COALESCE((SELECT jsonb_agg(to_jsonb(agents) ORDER BY won DESC, calls DESC) FROM agents), '[]'::jsonb),
    'lostReasons', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('reason', reason, 'leads', leads) ORDER BY leads DESC)
      FROM (SELECT COALESCE(lost_reason, 'Not recorded') AS reason, count(*) AS leads
            FROM best WHERE status = 'lost' GROUP BY 1) r), '[]'::jsonb),
    'openValue', (SELECT COALESCE(sum(deal_value), 0) FROM best WHERE status NOT IN ('won', 'lost')),
    'wonValue', (SELECT COALESCE(sum(deal_value), 0) FROM best WHERE status = 'won'),
    'wonInPeriod', (SELECT count(*) FROM public.lead_stage_events e WHERE e.to_stage = 'won' AND e.changed_at >= v_since),
    'callsInPeriod', (SELECT count(*) FROM public.call_logs c WHERE c.called_at >= v_since)
  ) INTO v_result;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.dashboard_stats(TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.lead_list_stats() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.queue_stats() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.assign_leads(BIGINT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pipeline_totals(BIGINT, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pipeline_report(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dashboard_stats(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lead_list_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.queue_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_leads(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pipeline_totals(BIGINT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pipeline_report(INTEGER) TO authenticated;
