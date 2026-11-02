import { useState } from 'react';
import { createPortal } from 'react-dom';
import { LOST_REASONS, stageLabel } from '../../utils/pipeline';

// Asks for the one extra detail a stage needs: why it was lost, or what it was worth.
export default function StageMoveModal({ lead, stage, onConfirm, onCancel }) {
  const [lostReason, setLostReason] = useState(LOST_REASONS[0]);
  const [dealValue, setDealValue] = useState(lead.deal_value ?? '');

  const submit = (e) => {
    e.preventDefault();
    if (stage === 'lost') onConfirm({ lost_reason: lostReason });
    else onConfirm(dealValue === '' ? {} : { deal_value: Number(dealValue) });
  };

  const fieldStyle = { background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)' };

  return createPortal(
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/70" onClick={onCancel}>
      <form onSubmit={submit} onClick={e => e.stopPropagation()} className="card-primitive w-full max-w-sm p-6 space-y-5">
        <div>
          <h3 className="text-xl heading-serif text-[var(--text)]">Move to {stageLabel(stage)}</h3>
          <p className="text-xs text-[var(--muted-light)] mt-1 truncate">{lead.name}</p>
        </div>

        {stage === 'lost' ? (
          <div>
            <label htmlFor="lost-reason" className="block text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] mb-2">Why was it lost?</label>
            <select id="lost-reason" value={lostReason} onChange={e => setLostReason(e.target.value)} className="w-full rounded-xl px-4 py-3 text-sm text-[var(--text)] focus:outline-none" style={fieldStyle}>
              {LOST_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        ) : (
          <div>
            <label htmlFor="deal-value" className="block text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] mb-2">Deal value (₹), optional</label>
            <input id="deal-value" type="number" min="0" value={dealValue} onChange={e => setDealValue(e.target.value)} className="w-full rounded-xl px-4 py-3 text-sm text-[var(--text)] focus:outline-none" style={fieldStyle} />
          </div>
        )}

        <div className="flex gap-3">
          <button type="button" onClick={onCancel} className="btn-secondary flex-1 py-3 text-xs font-mono uppercase tracking-widest">Cancel</button>
          <button type="submit" className="btn-primary flex-1 py-3 text-xs font-mono uppercase tracking-widest">Move Lead</button>
        </div>
      </form>
    </div>,
    document.body
  );
}
