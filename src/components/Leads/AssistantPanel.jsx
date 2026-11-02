import { useState } from 'react';
import { Sparkles, MessageCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { buildWhatsAppLink } from '../../utils/whatsapp';

const LIKELIHOOD_LABELS = { low: 'Low', medium: 'Medium', high: 'High' };

async function readFunctionError(error) {
  try {
    const body = await error.context.json();
    return body.error;
  } catch {
    return null;
  }
}

export default function AssistantPanel({ lead }) {
  const [result, setResult] = useState(null);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const run = async () => {
    setLoading(true);
    setError('');
    const { data, error: fnError } = await supabase.functions.invoke('lead-assistant', {
      body: { leadId: lead.id },
    });
    if (fnError) {
      setError((await readFunctionError(fnError)) || 'The assistant is unavailable right now.');
    } else {
      setResult(data);
      setDraft(data.whatsapp_draft);
    }
    setLoading(false);
  };

  return (
    <div className="glass-card-subtle p-4 rounded-xl border border-[rgba(200,180,138,0.06)] space-y-3" data-testid="ai-assistant">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xs font-mono uppercase tracking-[0.2em] text-[var(--muted)] flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[var(--accent)]" /> AI Call Assistant
        </h3>
        <button onClick={run} disabled={loading} className="btn-secondary px-3 py-2 text-[10px] font-mono uppercase tracking-widest disabled:opacity-50 whitespace-nowrap">
          {loading ? 'Thinking...' : result ? 'Refresh' : 'Prepare Me'}
        </button>
      </div>

      {error && <p className="text-xs text-[var(--danger)]" role="alert">{error}</p>}

      {result && (
        <div className="space-y-3 text-sm text-[var(--text)]">
          <p className="leading-relaxed">{result.summary}</p>
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] mb-1">
              Chance of closing (AI estimate): {LIKELIHOOD_LABELS[result.close_likelihood]}
            </p>
            <p className="text-xs text-[var(--muted-light)]">{result.likelihood_reason}</p>
          </div>
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] mb-1">Next step</p>
            <p className="text-xs text-[var(--muted-light)]">{result.next_action}</p>
          </div>
          <div>
            <label htmlFor="ai-draft" className="block text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] mb-1">
              WhatsApp draft, edit before sending
            </label>
            <textarea
              id="ai-draft"
              rows={5}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              className="w-full bg-[rgba(255,255,255,0.03)] border border-[rgba(200,180,138,0.08)] rounded-xl p-3 text-sm text-[var(--text)] focus:outline-none custom-scrollbar"
            />
          </div>
          {lead.phone && draft.trim() && (
            <a
              href={buildWhatsAppLink(lead.phone, lead.name, draft)}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary w-full py-2.5 flex items-center justify-center gap-2 text-xs font-mono uppercase tracking-widest"
            >
              <MessageCircle className="w-4 h-4" /> Review in WhatsApp
            </a>
          )}
        </div>
      )}
    </div>
  );
}
