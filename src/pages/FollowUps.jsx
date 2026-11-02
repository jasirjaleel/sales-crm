import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Phone, MessageCircle, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { buildWhatsAppLink } from '../utils/whatsapp';
import LeadDrawer from '../components/Leads/LeadDrawer';
import useMediaQuery from '../utils/useMediaQuery';
import { notifyError } from '../lib/notify';

export default function FollowUps() {
  const [followUps, setFollowUps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLeadDrawerId, setSelectedLeadDrawerId] = useState(null);
  const [selectedFollowUpColumn, setSelectedFollowUpColumn] = useState('due_now');
  const [activeTab, setActiveTab] = useState('due_now');
  const isMobile = useMediaQuery('(max-width: 767px)');

  const fetchFollowUps = async () => {
    try {
      setLoading(true);
      const user = JSON.parse(localStorage.getItem('crm_user') || '{}');
      const viewMode = user.role === 'admin' ? (localStorage.getItem('crm_view_mode') || 'admin') : 'agent';

      let openQuery = supabase.from('follow_ups').select('*, leads(name, phone)')
        .eq('completed', false).order('scheduled_at');
      // Completed ones only ever grow, so show the most recent rather than all of them
      let doneQuery = supabase.from('follow_ups').select('*, leads(name, phone)')
        .eq('completed', true).order('scheduled_at', { ascending: false }).limit(50);
      if (viewMode !== 'admin') {
        openQuery = openQuery.eq('agent_id', user.id);
        doneQuery = doneQuery.eq('agent_id', user.id);
      }

      const [open, done] = await Promise.all([openQuery, doneQuery]);
      if (open.error) throw open.error;
      if (done.error) throw done.error;
      setFollowUps([...(open.data || []), ...(done.data || [])]);
    } catch (err) {
      notifyError(err, 'Could not load follow-ups.');
} finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFollowUps();
  }, []);

  const handleNextFollowUp = () => {
    if (!selectedLeadDrawerId || !selectedFollowUpColumn) {
      setSelectedLeadDrawerId(null);
      fetchFollowUps();
      return;
    }
    const currentColumnItems = grouped[selectedFollowUpColumn] || [];
    const currentIndex = currentColumnItems.findIndex(fu => fu.lead_id === selectedLeadDrawerId);
    if (currentIndex >= 0 && currentIndex < currentColumnItems.length - 1) {
      setSelectedLeadDrawerId(currentColumnItems[currentIndex + 1].lead_id);
      fetchFollowUps();
    } else {
      setSelectedLeadDrawerId(null);
      fetchFollowUps();
    }
  };

  const handleAction = (e, lead, action) => {
    e.stopPropagation();
    const phone = lead.leads?.phone;
    if (action === 'call' && phone) {
      window.location.assign(`tel:${phone}`);
    } else if (action === 'whatsapp' && phone) {
      const link = buildWhatsAppLink(phone, lead.leads?.name || 'Lead');
      window.open(link, '_blank');
    }
  };

  const handleSnooze = async (e, followUpId) => {
    e.stopPropagation();
    try {
      const newTime = new Date(Date.now() + 2 * 60 * 60 * 1000);
      const { error } = await supabase
        .from('follow_ups')
        .update({ scheduled_at: newTime.toISOString() })
        .eq('id', followUpId);
      
      if (error) throw error;
      fetchFollowUps();
    } catch (err) {
      notifyError(err, 'Could not snooze this follow-up.');
}
  };

  const handleComplete = async (e, followUpId) => {
    e.stopPropagation();
    try {
      const { error } = await supabase
        .from('follow_ups')
        .update({ completed: true })
        .eq('id', followUpId);
      
      if (error) throw error;
      fetchFollowUps();
    } catch (err) {
      notifyError(err, 'Could not complete this follow-up.');
}
  };

  // Group follow-ups
  const grouped = { overdue: [], due_now: [], upcoming: [], completed: [] };
  const now = new Date();

  followUps.forEach(fu => {
    if (fu.completed) { grouped.completed.push(fu); return; }
    const scheduled = new Date(fu.scheduled_at);
    const gracePeriodEnd = new Date(scheduled.getTime() + 5 * 60 * 60 * 1000);
    if (now > gracePeriodEnd) grouped.overdue.push(fu);
    else if (scheduled <= now) grouped.due_now.push(fu);
    else grouped.upcoming.push(fu);
  });

  const columns = [
    { key: 'due_now', label: 'Due Now', items: grouped.due_now, color: 'text-[var(--accent-blue)]', bg: 'bg-[rgba(200,180,138,0.05)]' },
    { key: 'upcoming', label: 'Upcoming', items: grouped.upcoming, color: 'text-[var(--muted-light)]', bg: 'bg-[var(--bg-surface-elevated)]' },
    { key: 'overdue', label: 'Overdue', items: grouped.overdue, color: 'text-[var(--danger)]', bg: 'bg-[rgba(255,90,90,0.05)]' },
    { key: 'completed', label: 'Completed', items: grouped.completed, color: 'text-[var(--success-emerald)]', bg: 'bg-[rgba(0,196,140,0.05)]' },
  ];

  const formatScheduleTime = (dateStr) => {
    const date = new Date(dateStr);
    const today = new Date();
    const isToday = date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return isToday ? `Today ${timeStr}` : `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${timeStr}`;
  };

  const emptyMessages = {
    overdue: '✅ All clear — nothing overdue',
    due_now: 'Nothing due right now',
    upcoming: 'No upcoming follow-ups',
    completed: 'No completed follow-ups yet'
  };

  // Card renderer (shared between mobile/desktop)
  const renderCard = (fu, colKey) => (
    <motion.div 
      key={fu.id}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-primitive p-5 group hover:border-[var(--border-strong)] transition-all cursor-pointer"
      onClick={() => {
        setSelectedFollowUpColumn(colKey);
        setSelectedLeadDrawerId(fu.lead_id);
      }}
    >
      <div className="flex justify-between items-start mb-2 gap-3">
        <h4 className="font-medium tracking-tight text-lg text-[var(--text)] leading-tight truncate">{fu.leads?.name || 'Unknown Lead'}</h4>
        <span className={`text-[10px] font-mono whitespace-nowrap mt-1 ${
          colKey === 'overdue' ? 'text-[var(--danger)]' : 
          colKey === 'due_now' ? 'text-[var(--accent-blue)]' : 
          'text-[var(--muted)]'
        }`}>
          {formatScheduleTime(fu.scheduled_at)}
        </span>
      </div>
      
      <p className="text-xs font-mono text-[var(--muted-light)] mb-3">
        {fu.leads?.phone || 'No Phone'}
      </p>

      {fu.notes && (
        <div className="bg-[rgba(255,255,255,0.02)] p-2.5 rounded-lg border border-[var(--bg-surface-highlight)] mb-4">
          <p className="text-xs text-[var(--muted-light)] leading-relaxed italic line-clamp-2">
            "{fu.notes}"
          </p>
        </div>
      )}
      
      <div className="flex items-center gap-2 pt-3 border-t border-[var(--border-subtle)]">
        <button 
          onClick={(e) => handleAction(e, fu, 'call')}
          disabled={!fu.leads?.phone}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-mono transition-all active:scale-95 ${
            fu.leads?.phone 
              ? 'bg-[var(--border-subtle)] text-[var(--accent-blue)] border border-[var(--border-strong)]' 
              : 'bg-[rgba(255,255,255,0.02)] text-[var(--muted)] border border-[var(--bg-surface-highlight)] opacity-50'
          }`}
        >
          <Phone className="w-3.5 h-3.5" /> Call
        </button>
        <button 
          onClick={(e) => handleAction(e, fu, 'whatsapp')}
          disabled={!fu.leads?.phone}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-mono transition-all active:scale-95 ${
            fu.leads?.phone
              ? 'bg-[rgba(37,211,102,0.08)] text-[#25D366] border border-[rgba(37,211,102,0.15)]'
              : 'bg-[rgba(255,255,255,0.02)] text-[var(--muted)] border border-[var(--bg-surface-highlight)] opacity-50'
          }`}
        >
          <MessageCircle className="w-3.5 h-3.5" /> Chat
        </button>
        {colKey !== 'completed' && (
          <button 
            onClick={(e) => handleComplete(e, fu.id)}
            className="flex items-center justify-center gap-1 py-2.5 px-3 rounded-xl text-xs font-mono text-[var(--success-emerald)] bg-[rgba(0,196,140,0.08)] border border-[rgba(0,196,140,0.15)] transition-all active:scale-95"
            title="Mark complete"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
          </button>
        )}
        {colKey === 'overdue' && (
          <button 
            onClick={(e) => handleSnooze(e, fu.id)}
            className="py-2.5 px-3 rounded-xl text-xs font-mono text-[var(--warning)] bg-[rgba(247,185,85,0.08)] border border-[rgba(247,185,85,0.15)] transition-all active:scale-95"
            title="Snooze 2h"
          >
            +2h
          </button>
        )}
      </div>
    </motion.div>
  );

  return (
    <div className="space-y-5 pb-4 h-full flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-end border-b border-[var(--border-subtle)] pb-5">
        <div>
          <h1 className="text-3xl md:text-4xl heading-serif text-[var(--text)]">Follow Ups.</h1>
          <p className="text-[var(--muted)] mt-1 font-mono text-xs uppercase tracking-widest">Never miss a callback</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-medium tracking-tight text-[var(--accent-blue)]">{followUps.filter(f => !f.completed).length}</p>
          <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-[var(--muted)]">Pending</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-24">
          <div className="animate-pulse text-[var(--accent-blue)] font-medium tracking-tight text-xl">Loading follow-ups...</div>
        </div>
      ) : isMobile ? (
        /* ═══ MOBILE: Tab Navigation ═══ */
        <div className="flex-1 flex flex-col">
          {/* Tab Bar */}
          <div className="flex gap-1.5 overflow-x-auto custom-scrollbar pb-3 -mx-1 px-1">
            {columns.map(col => (
              <button
                key={col.key}
                onClick={() => setActiveTab(col.key)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-[10px] font-mono uppercase tracking-widest whitespace-nowrap transition-all ${
                  activeTab === col.key
                    ? 'bg-[var(--accent)] text-[#050505] shadow-[0_4px_12px_rgba(200,180,138,0.25)]'
                    : 'bg-[var(--bg-surface-elevated)] text-[var(--muted-light)] border border-[var(--border-subtle)]'
                }`}
              >
                {col.label}
                <span className={`min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[9px] ${
                  activeTab === col.key
                    ? 'bg-[rgba(0,0,0,0.2)] text-[#050505]'
                    : `${col.bg} ${col.color}`
                }`}>
                  {col.items.length}
                </span>
              </button>
            ))}
          </div>

          {/* Active Tab Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="flex flex-col gap-3 flex-1"
            >
              {columns.find(c => c.key === activeTab)?.items.map(fu => renderCard(fu, activeTab))}
              {columns.find(c => c.key === activeTab)?.items.length === 0 && (
                <div className="flex items-center justify-center h-32 text-center rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[rgba(255,255,255,0.01)]">
                  <p className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-widest px-4">
                    {emptyMessages[activeTab]}
                  </p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      ) : (
        /* ═══ DESKTOP: Horizontal Kanban ═══ */
        <div className="flex gap-6 overflow-x-auto pb-8 custom-scrollbar flex-1 items-start w-full">
          {columns.map(col => (
            <div key={col.key} className="flex-shrink-0 w-[340px] flex flex-col gap-4">
              <div className="bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] flex items-center justify-between px-5 py-4 rounded-xl">
                <h3 className={`font-mono text-xs uppercase tracking-widest ${col.color}`}>{col.label}</h3>
                <span className={`font-mono text-xs px-2 py-1 rounded-lg ${col.bg} ${col.color}`}>
                  {col.items.length}
                </span>
              </div>
              
              <div className="flex flex-col gap-4">
                {col.items.map(fu => renderCard(fu, col.key))}
                {col.items.length === 0 && (
                  <div className="flex items-center justify-center h-32 text-center rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[rgba(255,255,255,0.01)]">
                    <p className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-widest px-4 leading-relaxed">
                      {emptyMessages[col.key]}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedLeadDrawerId && (
        <LeadDrawer 
          leadId={selectedLeadDrawerId} 
          onClose={() => {
            setSelectedLeadDrawerId(null);
            fetchFollowUps();
          }} 
          onNext={handleNextFollowUp}
        />
      )}
    </div>
  );
}
