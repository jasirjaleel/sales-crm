// Demo data for the LOCAL Supabase. Logins: admin@test.local / agent@test.local,
// password local-test-password. Refuses to run against anything but localhost.
import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  execSync('npx supabase status -o env', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    .split('\n').filter(l => l.includes('=')).map(l => {
      const i = l.indexOf('=');
      return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')];
    })
);
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(env.API_URL)) throw new Error(`Refusing to run against ${env.API_URL}`);

const db = createClient(env.API_URL, env.SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const must = ({ data, error }) => { if (error) throw error; return data; };

const makeUser = async (email, name, role) => {
  const { user } = must(await db.auth.admin.createUser({ email, password: 'local-test-password', email_confirm: true, user_metadata: { name } }));
  must(await db.from('profiles').update({ role }).eq('id', user.id).select());
  return user.id;
};

const adminId = await makeUser('admin@test.local', 'Test Admin', 'admin');
const agentId = await makeUser('agent@test.local', 'Test Agent', 'agent');
const list = must(await db.from('lead_lists').insert({ name: 'Demo List', category: 'Other' }).select().single());

const leads = [
  ['Cafe Malabar', 'new', agentId, null],
  ['Green Dental', 'new', agentId, null],
  ['Spice Route', 'contacted', agentId, null],
  ['Pearl Interiors', 'interested', agentId, 25000],
  ['Metro Gym', 'meeting_booked', agentId, 40000],
  ['Nova Clinic', 'proposal_sent', adminId, 60000],
  ['Blue Bakery', 'won', adminId, 35000],
  ['Old Tailors', 'lost', adminId, null],
  ['Pool Lead One', 'new', null, null],
  ['Pool Lead Two', 'new', null, null],
].map(([name, status, assigned_to, deal_value], i) => ({
  name, status, assigned_to, deal_value, list_id: list.id,
  phone: `98765000${String(i).padStart(2, '0')}`,
  lost_reason: status === 'lost' ? 'Too Expensive' : null,
  ai_score: 9 - i * 0.5,
}));
must(await db.from('leads').insert(leads).select());
console.log('Seeded local demo data.');
