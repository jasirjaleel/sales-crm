import { useState } from 'react';
import { updateLead, moveLeadToStage } from '../../lib/leads';
import { STAGES, normalizeStage } from '../../utils/pipeline';
import { notify, notifyError } from '../../lib/notify';
import StageMoveModal from './StageMoveModal';

export default function DealPanel({ lead, onChanged }) {
  const [dealValue, setDealValue] = useState(lead.deal_value ?? '');
  const [closeDate, setCloseDate] = useState(lead.expected_close_date ?? '');
  const [email, setEmail] = useState(lead.email ?? '');
  const [pendingStage, setPendingStage] = useState(null);

  const saveField = async (changes) => {
    try {
      await updateLead(lead.id, changes);
      onChanged();
    } catch (err) {
      notifyError(err, 'Could not save this change.');
    }
  };

  const applyStage = async (stage, extra = {}) => {
    setPendingStage(null);
    try {
      await moveLeadToStage(lead.id, stage, extra);
      notify('Stage updated.');
      onChanged();
    } catch (err) {
      notifyError(err, 'Could not move this lead.');
    }
  };

  const handleStageChange = (stage) => {
    if (stage === 'lost' || stage === 'won') setPendingStage(stage);
    else applyStage(stage);
  };

  const labelClass = 'block text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] mb-1.5';
  const inputClass = 'w-full rounded-xl px-3 py-2.5 text-sm text-[var(--text)] focus:outline-none';
  const inputStyle = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(200,180,138,0.10)', colorScheme: 'dark' };

  return (
    <div className="glass-card-subtle p-4 rounded-xl border border-[rgba(200,180,138,0.06)] space-y-3">
      <div>
        <label htmlFor="lead-stage" className={labelClass}>Pipeline Stage</label>
        <select id="lead-stage" value={normalizeStage(lead.status)} onChange={e => handleStageChange(e.target.value)} className={inputClass} style={inputStyle}>
          {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        {lead.lost_reason && <p className="text-xs text-[var(--danger)] mt-1.5">Lost reason: {lead.lost_reason}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="lead-deal-value" className={labelClass}>Deal Value (₹)</label>
          <input
            id="lead-deal-value" type="number" min="0" value={dealValue}
            onChange={e => setDealValue(e.target.value)}
            onBlur={() => {
              const next = dealValue === '' ? null : Number(dealValue);
              if (next !== (lead.deal_value === null ? null : Number(lead.deal_value))) saveField({ deal_value: next });
            }}
            className={inputClass} style={inputStyle}
          />
        </div>
        <div>
          <label htmlFor="lead-close-date" className={labelClass}>Expected Close</label>
          <input
            id="lead-close-date" type="date" value={closeDate}
            onChange={e => setCloseDate(e.target.value)}
            onBlur={() => { if ((closeDate || null) !== (lead.expected_close_date || null)) saveField({ expected_close_date: closeDate || null }); }}
            className={inputClass} style={inputStyle}
          />
        </div>
      </div>

      <div>
        <label htmlFor="lead-email" className={labelClass}>Email</label>
        <input
          id="lead-email" type="email" value={email}
          onChange={e => setEmail(e.target.value)}
          onBlur={() => { if ((email || null) !== (lead.email || null)) saveField({ email: email.trim() || null }); }}
          className={inputClass} style={inputStyle}
        />
      </div>

      {pendingStage && (
        <StageMoveModal lead={lead} stage={pendingStage} onConfirm={extra => applyStage(pendingStage, extra)} onCancel={() => setPendingStage(null)} />
      )}
    </div>
  );
}
