import { useState, useEffect, useCallback } from 'react';
import { Phone, MessageCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { moveLeadToStage, cleanSearchTerm } from '../../lib/leads';
import { STAGES, stageColor } from '../../utils/pipeline';
import { buildWhatsAppLink } from '../../utils/whatsapp';
import useMediaQuery from '../../utils/useMediaQuery';
import { notifyError } from '../../lib/notify';
import StageMoveModal from './StageMoveModal';

const COLUMN_LIMIT = 50;

const formatINR = (amount) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);

export default function KanbanBoard({ search, listFilter, ownerId, refreshKey, onOpenLead }) {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [columns, setColumns] = useState({});
  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [mobileStage, setMobileStage] = useState('new');
  const [dragLead, setDragLead] = useState(null);
  const [dropStage, setDropStage] = useState(null);
  const [pendingMove, setPendingMove] = useState(null);

  const load = useCallback(async () => {
    try {
      const term = cleanSearchTerm(search);
      const results = await Promise.all(STAGES.map(stage => {
        let query = supabase.from('leads').select('*, profiles(name)', { count: 'exact' })
          .eq('status', stage.key)
          .order('stage_changed_at', { ascending: false })
          .limit(COLUMN_LIMIT);
        if (term) query = query.or(`name.ilike.%${term}%,phone.ilike.%${term}%`);
        if (listFilter !== 'all') query = query.eq('list_id', listFilter);
        if (ownerId) query = query.eq('assigned_to', ownerId);
        return query;
      }));

      const next = {};
      results.forEach((res, i) => {
        if (res.error) throw res.error;
        next[STAGES[i].key] = { leads: res.data || [], total: res.count || 0 };
      });
      setColumns(next);

      const { data: totals, error } = await supabase.rpc('pipeline_totals', {
        p_list_id: listFilter !== 'all' ? Number(listFilter) : null,
        p_assigned_to: ownerId || null,
      });
      if (error) throw error;
      setValues(Object.fromEntries((totals || []).map(t => [t.stage, t.total_value])));
    } catch (err) {
      notifyError(err, 'Could not load the pipeline.');
    } finally {
      setLoading(false);
    }
  }, [search, listFilter, ownerId]);

  useEffect(() => {
    const timer = setTimeout(load, 300);
    return () => clearTimeout(timer);
  }, [load, refreshKey]);

  const applyMove = async (lead, stage, extra = {}) => {
    setPendingMove(null);
    // Show the move straight away, then reload to pick up the real totals
    setColumns(prev => {
      const from = prev[lead.status];
      const to = prev[stage];
      if (!from || !to) return prev;
      return {
        ...prev,
        [lead.status]: { leads: from.leads.filter(l => l.id !== lead.id), total: from.total - 1 },
        [stage]: { leads: [{ ...lead, status: stage, ...extra }, ...to.leads], total: to.total + 1 },
      };
    });
    try {
      await moveLeadToStage(lead.id, stage, extra);
    } catch (err) {
      notifyError(err, 'Could not move this lead.');
    }
    load();
  };

  const requestMove = (lead, stage) => {
    if (!lead || lead.status === stage) return;
    if (stage === 'lost' || stage === 'won') setPendingMove({ lead, stage });
    else applyMove(lead, stage);
  };

  const renderCard = (lead) => (
    <div
      key={lead.id}
      draggable={!isMobile}
      onDragStart={() => setDragLead(lead)}
      onDragEnd={() => { setDragLead(null); setDropStage(null); }}
      onClick={(e) => { if (!e.target.closest('button')) onOpenLead(lead.id); }}
      className={`card-primitive p-4 cursor-pointer hover:border-[var(--border-strong)] transition-all ${dragLead?.id === lead.id ? 'opacity-40' : ''}`}
    >
      <div className="flex justify-between items-start gap-2 mb-1">
        <h4 className="font-medium tracking-tight text-sm text-[var(--text)] leading-snug break-words min-w-0">{lead.name}</h4>
        {lead.deal_value > 0 && (
          <span className="text-xs font-mono text-[var(--text)] whitespace-nowrap">{formatINR(lead.deal_value)}</span>
        )}
      </div>
      <p className="text-[11px] font-mono text-[var(--muted-light)] truncate">{lead.phone || 'No phone'}</p>
      <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] mt-1 truncate">
        {lead.profiles?.name || 'Unassigned'}
        {lead.last_outcome ? ` · ${lead.last_outcome.replace(/_/g, ' ')}` : ''}
      </p>
      {lead.lost_reason && <p className="text-[11px] text-[var(--danger)] mt-1 truncate">{lead.lost_reason}</p>}

      <div className="flex gap-2 mt-3">
        <button
          aria-label={`Call ${lead.name}`}
          disabled={!lead.phone}
          onClick={() => { window.location.href = `tel:${lead.phone}`; onOpenLead(lead.id); }}
          className={`btn-secondary flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-mono ${lead.phone ? '' : 'opacity-40 cursor-not-allowed'}`}
        >
          <Phone className="w-3 h-3" /> Call
        </button>
        <button
          aria-label={`WhatsApp ${lead.name}`}
          disabled={!lead.phone}
          onClick={() => { window.open(buildWhatsAppLink(lead.phone, lead.name), '_blank'); onOpenLead(lead.id); }}
          className={`btn-secondary flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-mono ${lead.phone ? '' : 'opacity-40 cursor-not-allowed'}`}
        >
          <MessageCircle className="w-3 h-3" /> Chat
        </button>
      </div>
    </div>
  );

  const renderOverflow = (col) => col && col.total > col.leads.length && (
    <p className="text-[10px] font-mono text-center text-[var(--muted)] uppercase tracking-widest py-2">
      Showing latest {col.leads.length} of {col.total}
    </p>
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center py-32">
        <div className="animate-pulse text-[var(--accent-blue)] font-medium tracking-tight text-xl">Loading pipeline...</div>
      </div>
    );
  }

  const moveModal = pendingMove && (
    <StageMoveModal
      lead={pendingMove.lead}
      stage={pendingMove.stage}
      onConfirm={extra => applyMove(pendingMove.lead, pendingMove.stage, extra)}
      onCancel={() => setPendingMove(null)}
    />
  );

  if (isMobile) {
    const col = columns[mobileStage];
    return (
      <div>
        <div className="flex gap-1.5 overflow-x-auto custom-scrollbar pb-3 -mx-1 px-1">
          {STAGES.map(stage => (
            <button
              key={stage.key}
              onClick={() => setMobileStage(stage.key)}
              className={`px-3 py-2 rounded-xl text-[10px] font-mono uppercase tracking-widest whitespace-nowrap transition-all ${
                mobileStage === stage.key
                  ? 'bg-[var(--accent)] text-[#050505]'
                  : 'bg-[var(--bg-surface-elevated)] text-[var(--muted-light)] border border-[var(--border-subtle)]'
              }`}
            >
              {stage.label} ({columns[stage.key]?.total || 0})
            </button>
          ))}
        </div>
        {values[mobileStage] > 0 && (
          <p className="text-xs font-mono text-[var(--muted-light)] mb-3">Value: {formatINR(values[mobileStage])}</p>
        )}
        <div className="flex flex-col gap-3">
          {col?.leads.map(renderCard)}
          {renderOverflow(col)}
          {col?.leads.length === 0 && (
            <div className="text-center py-12 rounded-2xl border border-dashed border-[var(--border-subtle)]">
              <p className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-widest">No leads in this stage</p>
            </div>
          )}
        </div>
        {moveModal}
      </div>
    );
  }

  return (
    <>
      <div className="flex gap-4 overflow-x-auto pb-8 custom-scrollbar items-start w-full">
        {STAGES.map(stage => {
          const col = columns[stage.key];
          return (
            <div
              key={stage.key}
              data-stage={stage.key}
              onDragOver={(e) => { e.preventDefault(); setDropStage(stage.key); }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDropStage(null); }}
              onDrop={(e) => { e.preventDefault(); setDropStage(null); requestMove(dragLead, stage.key); }}
              className={`flex-shrink-0 w-[270px] flex flex-col gap-3 rounded-2xl p-2 transition-colors ${dropStage === stage.key ? 'bg-[var(--bg-surface-elevated)]' : ''}`}
            >
              <div className="bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] px-4 py-3 rounded-xl" style={{ borderTop: `2px solid ${stageColor(stage.key)}` }}>
                <div className="flex items-center justify-between">
                  <h3 className="font-mono text-[11px] uppercase tracking-widest text-[var(--text)]">{stage.label}</h3>
                  <span className="font-mono text-xs text-[var(--text)]">{col?.total || 0}</span>
                </div>
                <p className="text-[11px] font-mono text-[var(--muted-light)] mt-1">{formatINR(values[stage.key])}</p>
              </div>
              <div className="flex flex-col gap-3 min-h-[80px]">
                {col?.leads.map(renderCard)}
                {renderOverflow(col)}
                {col?.leads.length === 0 && (
                  <div className="p-5 rounded-2xl border border-dashed border-[var(--border-subtle)] text-center">
                    <p className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-widest">Empty Stage</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {/* Won and Lost sit off-screen on most laptops, so bring them to the deal being dragged */}
      {dragLead && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex gap-3">
          {['won', 'lost'].map(stage => (
            <div
              key={stage}
              data-testid={`drop-${stage}`}
              onDragOver={(e) => { e.preventDefault(); setDropStage(`bar-${stage}`); }}
              onDragLeave={() => setDropStage(null)}
              onDrop={(e) => { e.preventDefault(); setDropStage(null); requestMove(dragLead, stage); }}
              className={`w-44 py-5 rounded-2xl text-center font-mono text-xs uppercase tracking-widest text-[var(--text)] border-2 border-dashed shadow-2xl transition-colors ${
                dropStage === `bar-${stage}` ? 'bg-[var(--bg-surface-highlight)]' : 'bg-[var(--bg-surface-elevated)]'
              }`}
              style={{ borderColor: stageColor(stage) }}
            >
              Drop: {stage === 'won' ? 'Won' : 'Lost'}
            </div>
          ))}
        </div>
      )}
      {moveModal}
    </>
  );
}
