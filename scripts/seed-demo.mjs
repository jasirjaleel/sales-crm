// Wipes and refills the PUBLIC DEMO project with invented data. Runs nightly from GitHub Actions.
// Needs DEMO_SUPABASE_URL, DEMO_SERVICE_ROLE_KEY and DEMO_PASSWORD. It refuses to touch any
// database that has not been marked with supabase/demo/mark-demo.sql.
import { createClient } from '@supabase/supabase-js';

const { DEMO_SUPABASE_URL: url, DEMO_SERVICE_ROLE_KEY: key, DEMO_PASSWORD: password } = process.env;
if (!url || !key || !password) throw new Error('Set DEMO_SUPABASE_URL, DEMO_SERVICE_ROLE_KEY and DEMO_PASSWORD.');

const db = createClient(url, key, { auth: { persistSession: false } });
const must = ({ data, error }) => { if (error) throw error; return data; };

const { error: markerError } = await db.from('demo_environment').select('marked_at').limit(1);
if (markerError) throw new Error(`Refusing to run: ${url} is not marked as a demo database.`);

// Repeatable "randomness", so every night's demo looks the same
let state = 42;
const rand = () => (state = (state * 1664525 + 1013904223) % 4294967296) / 4294967296;
const pick = (items) => items[Math.floor(rand() * items.length)];
const daysAgo = (d, hour = 11) => {
  const t = new Date();
  t.setDate(t.getDate() - d);
  t.setHours(hour, Math.floor(rand() * 60), 0, 0);
  return t.toISOString();
};

// ---- Wipe
for (const table of ['invoices', 'quotations', 'lead_stage_events', 'follow_ups', 'call_logs', 'leads', 'lead_lists', 'whatsapp_templates']) {
  must(await db.from(table).delete().gte('id', 0));
}
must(await db.from('ai_usage').delete().gte('requests', 0));
const { users } = must(await db.auth.admin.listUsers());
must(await db.from('profiles').delete().in('id', users.map(u => u.id)));
for (const u of users) must(await db.auth.admin.deleteUser(u.id));

// ---- People
const makeUser = async (email, name, role, target) => {
  const { user } = must(await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name } }));
  must(await db.from('profiles').update({ role, daily_target: target }).eq('id', user.id).select());
  return user.id;
};
const owner = await makeUser('demo-admin@example.com', 'Demo Owner', 'admin', 10);
const agents = [
  await makeUser('demo-agent@example.com', 'Sara Thomas', 'agent', 30),
  await makeUser('demo-agent-2@example.com', 'Arun Menon', 'agent', 30),
  await makeUser('demo-agent-3@example.com', 'Neha Varma', 'agent', 30),
];

// ---- Lists and leads (every business is invented)
const lists = must(await db.from('lead_lists').insert([
  { name: 'Clinics, Kochi', category: 'Healthcare', uploaded_by: owner },
  { name: 'Restaurants, Calicut', category: 'Food', uploaded_by: owner },
  { name: 'Retail, Trivandrum', category: 'Retail', uploaded_by: owner },
]).select());

const FIRST = ['Lotus', 'Harbour', 'Palm', 'Coral', 'Monsoon', 'Spice', 'Lagoon', 'Teak', 'Jasmine', 'Pepper', 'Backwater', 'Malabar', 'Sunrise', 'Cardamom', 'Coconut Grove'];
const SECOND = { Healthcare: ['Dental Care', 'Skin Clinic', 'Eye Centre', 'Physio'], Food: ['Kitchen', 'Bistro', 'Cafe', 'Bakery'], Retail: ['Textiles', 'Home Store', 'Opticals', 'Footwear'] };
const AREAS = { Healthcare: 'Kochi', Food: 'Calicut', Retail: 'Trivandrum' };
const SERVICES = ['Website Redesign', 'Google Ads Setup', 'Social Media Package', 'Local SEO Package'];
const NOTES = ['Owner prefers calls after 4 pm.', 'Website is outdated and not mobile friendly.', 'Asked for examples of similar work.', 'Runs ads already but unhappy with results.', 'Decision maker is the managing partner.', null, null];
const REASONS = ['Too Expensive', 'Chose Competitor', 'No Response', 'Not Interested'];

// How many leads sit in each stage: a believable funnel
const FUNNEL = { new: 24, contacted: 16, interested: 9, meeting_booked: 6, proposal_sent: 5, won: 6, lost: 8 };
const rows = [];
let n = 0;
for (const [stage, count] of Object.entries(FUNNEL)) {
  for (let i = 0; i < count; i++) {
    const list = pick(lists);
    const hasDeal = !['new', 'contacted', 'lost'].includes(stage);
    const idle = stage === 'new' ? 0 : Math.floor(rand() * 14) + (i === 0 ? 8 : 0);
    const rating = Math.round((3.4 + rand() * 1.5) * 10) / 10;
    const reviews = Math.floor(rand() * 180) + 5;
    rows.push({
      name: `${FIRST[n % FIRST.length]} ${pick(SECOND[list.category])}`,
      phone: `98950${String(10000 + n)}`,
      email: rand() > 0.6 ? `hello${n}@example.com` : null,
      website: rand() > 0.3 ? `https://example.com/business-${n}` : null,
      website_status: pick(['not_checked', 'no_website', 'needs_redesign', 'modern_website']),
      location: AREAS[list.category],
      category: list.category,
      business_type: pick(SECOND[list.category]),
      list_id: list.id,
      assigned_to: stage === 'new' && i % 3 === 0 ? null : (stage === 'won' && i === 0 ? owner : agents[n % agents.length]),
      status: stage,
      average_rating: rating,
      reviews,
      ai_score: Math.round(((rating / 5) * 6 + (Math.min(reviews, 200) / 200) * 4) * 10) / 10,
      notes: pick(NOTES),
      last_outcome: stage === 'new' ? null : pick(['no_answer', 'call_back', 'send_info']),
      lost_reason: stage === 'lost' ? pick(REASONS) : null,
      deal_value: hasDeal ? pick([18000, 25000, 35000, 45000, 60000, 85000]) : null,
      expected_close_date: hasDeal && !['won'].includes(stage) ? daysAgo(-(Math.floor(rand() * 30) - 3)).split('T')[0] : null,
      last_called_at: stage === 'new' ? null : daysAgo(idle),
    });
    n++;
  }
}
const leads = must(await db.from('leads').insert(rows).select());

// Triggers stamp stage dates with "now" only on update, so set realistic ones afterwards
for (const lead of leads.filter(l => l.last_called_at)) {
  must(await db.from('leads').update({ stage_changed_at: lead.last_called_at }).eq('id', lead.id));
}

// ---- Activity
const worked = leads.filter(l => l.status !== 'new' && l.assigned_to);
const calls = [];
for (const lead of worked) {
  const attempts = 1 + Math.floor(rand() * 3);
  for (let a = 0; a < attempts; a++) {
    calls.push({
      lead_id: lead.id, agent_id: lead.assigned_to,
      outcome: a === attempts - 1 ? (lead.last_outcome || 'no_answer') : 'no_answer',
      notes: a === attempts - 1 ? 'Spoke briefly, will follow up.' : null,
      called_at: daysAgo(Math.floor(rand() * 13)),
    });
  }
}
// Today's calls so the dashboard has something to show first thing
for (const agent of agents) {
  for (let i = 0; i < 6 + Math.floor(rand() * 10); i++) {
    const lead = worked.find(l => l.assigned_to === agent);
    if (lead) calls.push({ lead_id: lead.id, agent_id: agent, outcome: pick(['no_answer', 'send_info', 'call_back']), called_at: daysAgo(0, 9) });
  }
}
must(await db.from('call_logs').insert(calls).select('id'));

const open = worked.filter(l => ['contacted', 'interested', 'meeting_booked'].includes(l.status)).slice(0, 14);
must(await db.from('follow_ups').insert(open.map((lead, i) => ({
  lead_id: lead.id, agent_id: lead.assigned_to,
  scheduled_at: new Date(Date.now() + (i - 4) * 3 * 60 * 60 * 1000).toISOString(),
  notes: 'Call back about the proposal.',
}))).select('id'));

// Quotations and invoices go in with their final status, so triggers record paid dates
const deals = leads.filter(l => ['proposal_sent', 'won'].includes(l.status));
const quotes = must(await db.from('quotations').insert(deals.map(lead => ({
  lead_id: lead.id, service: pick(SERVICES), price: lead.deal_value, discount: 0, timeline: '14 Days',
  deliverables: '- Strategy call\n- Build and launch\n- 30 days of support',
  terms: '50% upfront payment to commence work. Balance upon completion.',
  status: lead.status === 'won' ? 'Invoiced' : 'Sent', created_by: lead.assigned_to,
}))).select());
const today = new Date().toISOString().split('T')[0];
const invoiced = quotes.filter(q => q.status === 'Invoiced');
must(await db.from('invoices').insert(invoiced.map((q, i) => ({
  quotation_id: q.id, lead_id: q.lead_id, amount: q.price, discount: 0, issue_date: today,
  due_date: daysAgo(i % 3 === 2 ? 5 : -14).split('T')[0],
  status: i % 3 === 0 ? 'Unpaid' : 'Paid', notes: `From Quotation #${q.id}`,
}))).select('id'));

must(await db.from('whatsapp_templates').insert([
  { name: 'First Contact', message: 'Hi {{name}},\n\nWe noticed your business online and had a few ideas that may help bring in more customers.\n\nWould you be open to a quick conversation?', is_active: true },
  { name: 'After a Missed Call', message: 'Hi {{name}}, I tried calling you earlier. When would be a good time to talk?', is_active: false },
]).select('id'));

console.log(`Demo reset: ${leads.length} leads, ${calls.length} calls, ${quotes.length} quotations, ${invoiced.length} invoices.`);
