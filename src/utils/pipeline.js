// Stage names and order are mirrored in supabase/migrations/20261101000300_pipeline.sql
export const STAGES = [
  { key: 'new', label: 'New', color: 'var(--muted-light)' },
  { key: 'contacted', label: 'Contacted', color: 'var(--accent-blue)' },
  { key: 'interested', label: 'Interested', color: 'var(--success-emerald)' },
  { key: 'meeting_booked', label: 'Meeting Booked', color: '#8B5CF6' },
  { key: 'proposal_sent', label: 'Proposal Sent', color: 'var(--warning)' },
  { key: 'won', label: 'Won', color: 'var(--success)' },
  { key: 'lost', label: 'Lost', color: 'var(--danger)' },
];

export const LOST_REASONS = [
  'Not Interested',
  'Too Expensive',
  'Chose Competitor',
  'No Response',
  'Bad Number',
  'Duplicate',
  'Already Contacted',
  'Other',
];

// Statuses written before the pipeline existed, or by a browser tab still on the old app.
const LEGACY_STAGES = {
  no_answer: 'contacted',
  call_back: 'contacted',
  send_info: 'contacted',
  not_interested: 'lost',
  closed: 'won',
};

const STAGE_ORDER = ['new', 'contacted', 'interested', 'meeting_booked', 'proposal_sent', 'won'];

export function normalizeStage(status) {
  if (STAGES.some(s => s.key === status)) return status;
  return LEGACY_STAGES[status] || 'new';
}

export function stageLabel(status) {
  const stage = normalizeStage(status);
  return STAGES.find(s => s.key === stage).label;
}

export function stageColor(status) {
  const stage = normalizeStage(status);
  return STAGES.find(s => s.key === stage).color;
}

// followUp: 'in_1h' | 'tomorrow_10am' | 'custom' | null
const OUTCOMES = {
  no_answer: { outcome: 'no_answer', label: 'No Answer', followUp: 'in_1h' },
  send_info: { outcome: 'send_info', label: 'Send Info', followUp: 'tomorrow_10am' },
  call_back: { outcome: 'call_back', label: 'Call Back', followUp: 'custom' },
  not_interested: { outcome: 'not_interested', label: 'Not Interested', lostReason: 'Not Interested' },
  skip_bad_number: { outcome: 'bad_number', label: 'Bad Number', lostReason: 'Bad Number' },
  skip_duplicate: { outcome: 'duplicate', label: 'Duplicate', lostReason: 'Duplicate' },
  skip_already_contacted: { outcome: 'already_contacted', label: 'Already Contacted', lostReason: 'Already Contacted' },
  skip_call_later: { outcome: 'call_back', label: 'Call Later', followUp: 'tomorrow_10am' },
  skip_other: { outcome: 'other', label: 'Other', lostReason: 'Other' },
};

export function resolveOutcome(selected) {
  return OUTCOMES[selected] || null;
}

// A call never drags a lead backwards: a no-answer on a booked meeting stays a booked meeting.
export function stageAfterOutcome(currentStatus, selected) {
  const current = normalizeStage(currentStatus);
  const resolved = resolveOutcome(selected);
  if (!resolved) return current;
  if (current === 'won') return 'won';
  if (resolved.lostReason) return 'lost';
  return STAGE_ORDER.indexOf(current) > STAGE_ORDER.indexOf('contacted') ? current : 'contacted';
}

export function followUpTime(kind, now = new Date()) {
  if (kind === 'in_1h') return new Date(now.getTime() + 60 * 60 * 1000);
  if (kind === 'tomorrow_10am') {
    const t = new Date(now);
    t.setDate(t.getDate() + 1);
    t.setHours(10, 0, 0, 0);
    return t;
  }
  return null;
}
