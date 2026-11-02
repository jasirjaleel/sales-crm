import { supabase } from './supabase';

// Moves a lead to a stage. Asks for the row back so a change blocked by access rules
// reports as a failure instead of silently doing nothing.
export async function updateLead(leadId, changes) {
  const { data, error } = await supabase.from('leads').update(changes).eq('id', leadId).select('id');
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('You do not have access to this lead.');
}

export async function moveLeadToStage(leadId, stage, extra = {}) {
  await updateLead(leadId, { status: stage, ...extra });
}

// PostgREST filters use commas and brackets as syntax, so strip them from search text.
export function cleanSearchTerm(search) {
  return search.replace(/[,()%*\\"]/g, ' ').trim();
}
