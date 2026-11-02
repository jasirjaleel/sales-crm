// Runs real logged-in sessions against the LOCAL Supabase only. It wipes nothing, but it
// does create users and data, so it refuses to run against anything but localhost.
//   npx supabase start && npm run test:security
import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  execSync('npx supabase status -o env', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    .split('\n').filter(l => l.includes('=')).map(l => {
      const i = l.indexOf('=');
      return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')];
    })
);
const URL_ = env.API_URL;
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(URL_)) throw new Error(`Refusing to run against ${URL_}`);

const noPersist = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(URL_, env.SERVICE_ROLE_KEY, noPersist);
const anon = createClient(URL_, env.ANON_KEY, noPersist);

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${detail}`}`);
  if (!ok) failed++;
};

const stamp = Date.now();
async function makeUser(label, role) {
  const email = `${label}-${stamp}@test.local`;
  const password = `test-${stamp}-password`;
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name: label } });
  if (error) throw error;
  if (role === 'admin') await service.from('profiles').update({ role: 'admin' }).eq('id', data.user.id);
  const client = createClient(URL_, env.ANON_KEY, noPersist);
  const { error: loginError } = await client.auth.signInWithPassword({ email, password });
  if (loginError) throw loginError;
  return { id: data.user.id, client };
}

const admin = await makeUser('admin', 'admin');
const agentA = await makeUser('agenta', 'agent');
const agentB = await makeUser('agentb', 'agent');

const ins = async (table, row) => {
  const { data, error } = await service.from(table).insert(row).select().single();
  if (error) throw error;
  return data;
};
const list = await ins('lead_lists', { name: `List ${stamp}` });
const leadA = await ins('leads', { name: 'A lead', phone: `9${stamp}`.slice(0, 10), assigned_to: agentA.id, list_id: list.id });
const leadB = await ins('leads', { name: 'B lead', assigned_to: agentB.id, list_id: list.id });
const pool = await ins('leads', { name: 'Pool lead', list_id: list.id });
const invoice = await ins('invoices', { lead_id: leadA.id, amount: 1000 });
const quoteB = await ins('quotations', { lead_id: leadB.id, service: 'Site', price: 5000 });

// ---- Not logged in
{
  const { data } = await anon.from('leads').select('id').eq('id', leadA.id);
  check('anonymous cannot read leads', data?.length === 0);
  const { error } = await anon.rpc('dashboard_stats');
  check('anonymous cannot call stats', !!error);
}

// ---- Privilege escalation
{
  const { error } = await agentA.client.from('profiles').update({ role: 'admin' }).eq('id', agentA.id);
  const { data } = await service.from('profiles').select('role').eq('id', agentA.id).single();
  check('agent cannot make themselves admin', !!error && data.role === 'agent');

  const { error: upsertError } = await agentA.client.from('profiles').upsert({ id: agentA.id, email: `agenta-${stamp}@test.local`, name: 'x', role: 'admin' });
  const { data: after } = await service.from('profiles').select('role').eq('id', agentA.id).single();
  check('agent cannot upsert to admin', !!upsertError && after.role === 'agent');

  const { error: targetError } = await agentA.client.from('profiles').update({ daily_target: 1 }).eq('id', agentA.id);
  check('agent cannot change their own target', !!targetError);

  const { error: renameError } = await agentA.client.from('profiles').update({ name: 'Agent A' }).eq('id', agentA.id);
  check('agent can still change their name', !renameError, renameError?.message);

  const { data: other } = await agentA.client.from('profiles').update({ name: 'hacked' }).eq('id', agentB.id).select();
  check("agent cannot edit another agent's profile", other?.length === 0);
}

// ---- Lead isolation
{
  const { data } = await agentA.client.from('leads').select('id').in('id', [leadA.id, leadB.id, pool.id]);
  const ids = (data || []).map(l => l.id);
  check('agent sees own lead', ids.includes(leadA.id));
  check('agent sees unassigned lead', ids.includes(pool.id));
  check("agent cannot read another agent's lead", !ids.includes(leadB.id));

  const { data: updated } = await agentA.client.from('leads').update({ notes: 'hack' }).eq('id', leadB.id).select();
  check("agent cannot update another agent's lead", updated?.length === 0);

  const { error: handOff } = await agentA.client.from('leads').update({ assigned_to: agentB.id }).eq('id', leadA.id);
  check('agent cannot hand a lead to someone else', !!handOff);

  const { error: forged } = await agentA.client.from('leads').insert({ name: 'x', assigned_to: agentB.id });
  check("agent cannot create leads in someone else's name", !!forged);

  await agentA.client.from('leads').delete().eq('id', leadA.id);
  const { data: still } = await service.from('leads').select('id').eq('id', leadA.id);
  check('agent cannot delete leads', still?.length === 1);

  const { data: adminRows } = await admin.client.from('leads').select('id').in('id', [leadA.id, leadB.id, pool.id]);
  check('admin sees all leads', adminRows?.length === 3);
}

// ---- Related records
{
  const { error: forgedCall } = await agentA.client.from('call_logs').insert({ lead_id: leadB.id, outcome: 'no_answer' });
  check("agent cannot log a call on another agent's lead", !!forgedCall);
  const { error: ownCall } = await agentA.client.from('call_logs').insert({ lead_id: leadA.id, outcome: 'no_answer' });
  check('agent can log a call on their own lead', !ownCall, ownCall?.message);
  const { data: log } = await service.from('call_logs').select('agent_id').eq('lead_id', leadA.id).single();
  check('call log owner is set by the database', log?.agent_id === agentA.id);

  const { error: fu } = await agentA.client.from('follow_ups').insert({ lead_id: leadA.id, scheduled_at: new Date().toISOString() });
  check('agent can create a follow-up', !fu, fu?.message);
  const { data: fuClosed, error: fuErr } = await agentA.client.from('follow_ups').update({ completed: true }).eq('lead_id', leadA.id).eq('completed', false).select();
  check('follow-up can be marked complete', !fuErr && fuClosed?.length === 1, fuErr?.message);
}

// ---- Finance
{
  const { data: inv } = await agentA.client.from('invoices').select('id');
  check('agent cannot read invoices', inv?.length === 0);
  const { error: invForge } = await agentA.client.from('invoices').insert({ lead_id: leadA.id, amount: 1 });
  check('agent cannot create invoices', !!invForge);
  const { data: invEdit } = await agentA.client.from('invoices').update({ status: 'Paid' }).eq('id', invoice.id).select();
  check('agent cannot mark invoices paid', invEdit?.length === 0);

  const { data: q } = await agentA.client.from('quotations').select('id').eq('id', quoteB.id);
  check("agent cannot read another agent's quotation", q?.length === 0);
  const { error: myQuote } = await agentA.client.from('quotations').insert({ lead_id: leadA.id, service: 'Mine', price: 100 });
  check('agent can quote their own lead', !myQuote, myQuote?.message);
  const { error: otherQuote } = await agentA.client.from('quotations').insert({ lead_id: leadB.id, service: 'No', price: 100 });
  check("agent cannot quote another agent's lead", !!otherQuote);

  for (const [fn, args] of [['queue_stats', {}], ['assign_leads', {}], ['pipeline_report', {}], ['owner_summary', {}]]) {
    const { error } = await agentA.client.rpc(fn, args);
    check(`agent cannot call ${fn}`, !!error);
  }
  const { data: stats } = await agentA.client.rpc('dashboard_stats', { p_view: 'admin' });
  check('agent stats only include themselves, even when asking for the admin view', stats?.team?.length === 1 && stats.team[0].id === agentA.id);
}

// ---- AI usage limit
{
  const { data: first } = await agentA.client.rpc('consume_ai_quota', { p_daily_limit: 1 });
  const { data: second } = await agentA.client.rpc('consume_ai_quota', { p_daily_limit: 1 });
  check('daily AI limit is enforced', first === true && second === false);
  const { data: usage } = await agentA.client.from('ai_usage').select('*');
  check('AI usage table cannot be read directly', usage?.length === 0);
  const { error: tamper } = await agentA.client.from('ai_usage').insert({ user_id: agentA.id, requests: 0, day: '2030-01-01' });
  check('AI usage table cannot be written directly', !!tamper);
  const { error: anonAi } = await anon.rpc('consume_ai_quota', { p_daily_limit: 1 });
  check('anonymous cannot use the AI quota', !!anonAi);
}

// ---- Pipeline automation
{
  const { data: q, error } = await admin.client.from('quotations').insert({ lead_id: leadB.id, service: 'Deal', price: 20000, discount: 5000 }).select().single();
  if (error) throw error;
  await admin.client.from('quotations').update({ status: 'Sent' }).eq('id', q.id);
  let { data: lead } = await service.from('leads').select('status, deal_value').eq('id', leadB.id).single();
  check('sending a quotation moves the lead to Proposal Sent', lead.status === 'proposal_sent');
  check('deal value comes from the quotation, after discount', Number(lead.deal_value) === 15000);

  const inv = await ins('invoices', { lead_id: leadB.id, amount: 15000 });
  await admin.client.from('invoices').update({ status: 'Paid' }).eq('id', inv.id);
  ({ data: lead } = await service.from('leads').select('status').eq('id', leadB.id).single());
  check('a paid invoice moves the lead to Won', lead.status === 'won');

  const { data: events } = await service.from('lead_stage_events').select('from_stage,to_stage,changed_by').eq('lead_id', leadB.id).order('id');
  check('stage history is recorded', events?.length === 2 && events[1].to_stage === 'won' && events[1].changed_by === admin.id);

  const { error: forgedEvent } = await admin.client.from('lead_stage_events').insert({ lead_id: leadB.id, to_stage: 'won' });
  check('stage history cannot be written by hand', !!forgedEvent);

  await service.from('leads').update({ status: 'lost', lost_reason: 'Other' }).eq('id', pool.id);
  await service.from('leads').update({ status: 'interested' }).eq('id', pool.id);
  const { data: reopened } = await service.from('leads').select('lost_reason').eq('id', pool.id).single();
  check('reopening a lead clears its lost reason', reopened.lost_reason === null);

  const { data: listRow } = await service.from('lead_lists').select('total_leads').eq('id', list.id).single();
  check('list total is kept correct by the database', listRow.total_leads === 3);

  const { data: report, error: reportErr } = await admin.client.rpc('pipeline_report', { p_days: 30 });
  check('admin can load the pipeline report', !reportErr && report.funnel.length === 6, reportErr?.message);
  const { data: dash, error: dashErr } = await admin.client.rpc('dashboard_stats', { p_tz: 'Asia/Kolkata', p_view: 'admin' });
  check('dashboard chart covers 14 days', !dashErr && dash.chart.length === 14, dashErr?.message || JSON.stringify(dash?.chart?.length));
}

console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll security checks passed');
process.exit(failed ? 1 : 0);
