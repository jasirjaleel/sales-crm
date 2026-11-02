import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Shuffle, RotateCcw, AlertCircle, Database, UserPlus } from 'lucide-react';
import useMediaQuery from '../utils/useMediaQuery';

export default function QueueManager() {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const [leadLists, setLeadLists] = useState([]);
  const [selectedListId, setSelectedListId] = useState('');

  const [confirmModal, setConfirmModal] = useState({ isOpen: false, type: null, title: '', message: '', actionLabel: '' });
  const [notificationModal, setNotificationModal] = useState({ isOpen: false, title: '', message: '', type: 'success' });

  const fetchStats = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('queue_stats');
      if (error) throw error;
      setStats(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLeadLists = async () => {
    try {
      const { data, error } = await supabase.rpc('lead_list_stats');
      if (error) throw error;
      setLeadLists((data || []).map(list => ({ ...list, unassigned_leads: list.pool_leads })));
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchLeadLists();
  }, []);

  const initiateAutoAssign = () => {
    setConfirmModal({
      isOpen: true,
      type: 'auto-assign',
      title: 'Auto-Assign Leads',
      message: 'This will automatically distribute unassigned leads to users based on their daily targets. Do you wish to continue?',
      actionLabel: 'Confirm Assignment'
    });
  };

  const initiateRebalance = () => {
    setConfirmModal({
      isOpen: true,
      type: 'rebalance',
      title: 'Rebalance Queue',
      message: 'WARNING: This will return all un-called leads currently in queues back to the unassigned pool. Use this to completely reshuffle the day.',
      actionLabel: 'Confirm Rebalance'
    });
  };

  const handleConfirmAction = async () => {
    const { type } = confirmModal;
    setConfirmModal({ ...confirmModal, isOpen: false });
    
    if (type === 'auto-assign') {
      await executeAutoAssign();
    } else if (type === 'rebalance') {
      await executeRebalance();
    }
  };

  const executeAutoAssign = async () => {
    try {
      setProcessing(true);
      
      const { data: assigned, error } = await supabase.rpc('assign_leads', {
        p_list_id: selectedListId ? Number(selectedListId) : null
      });
      if (error) throw error;
      if (assigned === 0) {
        throw new Error('No leads were assigned. Either the pool is empty or everyone is already at their daily target.');
      }

      setNotificationModal({ isOpen: true, title: 'Success', message: `Assigned ${assigned} leads successfully.`, type: 'success' });
      fetchStats();
      fetchLeadLists();
    } catch (err) {
      setNotificationModal({ isOpen: true, title: 'Error', message: err.message || 'Failed to auto-assign leads.', type: 'error' });
    } finally {
      setProcessing(false);
    }
  };

  const executeRebalance = async () => {
    try {
      setProcessing(true);
      
      const { error } = await supabase
        .from('leads')
        .update({ assigned_to: null })
        .not('assigned_to', 'is', null)
        .eq('status', 'new');
        
      if (error) throw error;

      setNotificationModal({ isOpen: true, title: 'Queue Rebalanced', message: 'Uncalled leads returned to pool.', type: 'success' });
      fetchStats();
      fetchLeadLists();
    } catch {
      setNotificationModal({ isOpen: true, title: 'Error', message: 'Failed to rebalance queue.', type: 'error' });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12 max-w-5xl">
      
      <div className="flex justify-between items-end border-b border-[rgba(200,180,138,0.06)] pb-6">
        <div>
          <h1 className="text-4xl heading-serif text-[var(--text)]">Queue Management.</h1>
          <p className="text-[var(--muted)] mt-2 flex items-center gap-2 font-mono text-sm tracking-wider uppercase">
            <Database className="w-4 h-4 text-[var(--accent)]" />
            Lead Pool Distribution
          </p>
        </div>
        <button 
          onClick={() => window.dispatchEvent(new Event('crm:openCreateLead'))}
          className="btn-primary px-4 py-2 text-xs font-mono uppercase tracking-widest flex items-center gap-2"
        >
          <UserPlus className="w-4 h-4" /> Add Lead
        </button>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-24 glass-card"></div>
          <div className="h-64 glass-card"></div>
        </div>
      ) : stats ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Content Area */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Mobile Action Buttons (Top) */}
            {isMobile && (
              <div className="flex flex-col gap-3 mb-6">
                <button 
                  onClick={initiateAutoAssign}
                  disabled={processing}
                  className="btn-primary w-full py-4 font-mono text-xs uppercase tracking-[0.1em] flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Shuffle className="w-4 h-4" /> Auto Assign Today's Leads
                </button>
                <button 
                  onClick={initiateRebalance}
                  disabled={processing}
                  className="btn-secondary w-full py-4 font-mono text-xs uppercase tracking-[0.1em] flex items-center justify-center gap-2 hover:text-[var(--accent)] disabled:opacity-50"
                >
                  <RotateCcw className="w-4 h-4" /> Rebalance Queue
                </button>
              </div>
            )}

            {isMobile ? (
              /* Mobile Card View */
              <div className="space-y-4">
                {stats.team.map((user) => {
                  const percent = user.target > 0 ? Math.min(100, Math.round((user.completed / user.target) * 100)) : 0;
                  return (
                    <div key={user.id} className="glass-card-subtle p-5 relative overflow-hidden" style={{ borderRadius: '16px' }}>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-full avatar-gold flex items-center justify-center font-serif text-xs text-[var(--accent)] flex-shrink-0">
                          {user.name.charAt(0)}
                        </div>
                        <span className="font-serif text-xl text-[var(--text)] truncate">{user.name}</span>
                      </div>
                      
                      {/* Mini Progress */}
                      <div className="w-full h-1.5 rounded-full overflow-hidden mb-4" style={{ background: 'rgba(200, 180, 138, 0.08)' }}>
                        <div className="h-full progress-gold transition-all duration-500" style={{ width: `${percent}%` }}></div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)] rounded-xl p-3 text-center">
                          <p className="text-[9px] font-mono uppercase text-[var(--muted-light)] mb-1">Target</p>
                          <p className="text-lg font-serif text-[var(--text)]">{user.target}</p>
                        </div>
                        <div className="bg-[rgba(0,196,140,0.05)] border border-[rgba(0,196,140,0.1)] rounded-xl p-3 text-center">
                          <p className="text-[9px] font-mono uppercase text-[var(--success)] opacity-80 mb-1">Done</p>
                          <p className="text-lg font-serif text-[var(--success)]">{user.completed}</p>
                        </div>
                        <div className="bg-[rgba(200,180,138,0.05)] border border-[rgba(200,180,138,0.1)] rounded-xl p-3 text-center">
                          <p className="text-[9px] font-mono uppercase text-[var(--accent)] opacity-80 mb-1">Left</p>
                          <p className="text-lg font-serif text-[var(--accent)]">{user.remaining}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Desktop Table View */
              <>
                <div className="glass-card overflow-hidden" style={{ borderRadius: '16px' }}>
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead style={{ background: 'rgba(5, 5, 5, 0.6)', borderBottom: '1px solid rgba(200, 180, 138, 0.06)' }}>
                      <tr>
                        <th className="px-6 py-4 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Agent</th>
                        <th className="px-6 py-4 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)] text-center">Daily Target</th>
                        <th className="px-6 py-4 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)] text-center">Assigned Today</th>
                        <th className="px-6 py-4 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)] text-center">Completed</th>
                        <th className="px-6 py-4 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)] text-center">Remaining</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[rgba(200,180,138,0.04)]">
                      {stats.team.map((user) => (
                        <tr key={user.id} className="hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full avatar-gold flex items-center justify-center font-serif text-xs text-[var(--accent)]">
                                {user.name.charAt(0)}
                              </div>
                              <span className="font-serif text-lg text-[var(--text)]">{user.name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-5 font-mono text-center text-[var(--muted)]">{user.target}</td>
                          <td className="px-6 py-5 font-mono text-center text-[var(--text)]">{user.assigned}</td>
                          <td className="px-6 py-5 font-mono text-center text-[var(--success)]">{user.completed}</td>
                          <td className="px-6 py-5 font-mono text-center text-[var(--accent)]">{user.remaining}</td>
                        </tr>
                      ))}
                      {/* Team Totals Row */}
                      <tr style={{ background: 'rgba(5, 5, 5, 0.4)' }}>
                        <td className="px-6 py-5 font-serif text-lg text-[var(--muted-light)] pl-[72px]">Team Total</td>
                        <td className="px-6 py-5 font-mono text-center text-[var(--muted)]">{stats.teamTarget}</td>
                        <td className="px-6 py-5 font-mono text-center text-[var(--text)]">{stats.team.reduce((a, b) => a + b.assigned, 0)}</td>
                        <td className="px-6 py-5 font-mono text-center text-[var(--success)]">{stats.teamCompleted}</td>
                        <td className="px-6 py-5 font-mono text-center text-[var(--accent)]">{stats.team.reduce((a, b) => a + b.remaining, 0)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Desktop Action Buttons (Bottom) */}
                <div className="flex gap-4">
                  <button 
                    onClick={initiateAutoAssign}
                    disabled={processing}
                    className="btn-primary flex-1 py-4 font-mono uppercase tracking-[0.2em] flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                    <Shuffle className="w-5 h-5" /> Auto Assign Today's Leads
                  </button>
                  <button 
                    onClick={initiateRebalance}
                    disabled={processing}
                    className="btn-secondary py-4 px-6 font-mono uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:text-[var(--accent)] disabled:opacity-50"
                  >
                    <RotateCcw className="w-5 h-5" /> Rebalance Queue
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            
            {/* Unassigned Pool Widget */}
            <div className="glass-card p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-[0.04]">
                <Database className="w-32 h-32 text-[var(--accent)]" />
              </div>
              <h3 className="font-serif text-2xl text-[var(--text)] mb-6">Lead Pool</h3>
              
              <div className="space-y-4 font-mono text-sm tracking-widest uppercase mb-8">
                <div className="flex justify-between border-b border-[rgba(200,180,138,0.06)] pb-3">
                  <span className="text-[var(--muted)]">Total Available</span>
                  <span className="text-[var(--text)]">{stats.totalAvailable + stats.team.reduce((a,b) => a + b.assigned, 0)}</span>
                </div>
                <div className="flex justify-between border-b border-[rgba(200,180,138,0.06)] pb-3">
                  <span className="text-[var(--muted)]">Assigned Today</span>
                  <span className="text-[var(--text)]">{stats.team.reduce((a,b) => a + b.assigned, 0)}</span>
                </div>
                <div className="flex justify-between pt-2">
                  <span className="text-[var(--accent)] font-bold">Unassigned Pool</span>
                  <span className="text-[var(--accent)] font-bold text-xl">{stats.totalAvailable}</span>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--muted)] mb-3">Source: Lead List</label>
                <select 
                  value={selectedListId}
                  onChange={(e) => setSelectedListId(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-[var(--text)] focus:outline-none font-sans"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(200,180,138,0.10)' }}
                >
                  <option value="">All Lists (Global Pool)</option>
                  {leadLists.map(list => (
                    <option key={list.id} value={list.id}>{list.name} ({list.unassigned_leads} in pool)</option>
                  ))}
                </select>
              </div>

              <div className="glass-card-subtle p-4 flex items-start gap-3" style={{ borderRadius: '12px' }}>
                <AlertCircle className="w-5 h-5 text-[var(--accent)] flex-shrink-0 mt-0.5 opacity-60" />
                <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--muted)] leading-relaxed">
                  Auto-Assign will pull leads from the unassigned pool based on daily targets. Remaining leads stay untouched.
                </p>
              </div>
            </div>

          </div>

        </div>
      ) : (
        <div className="text-center py-12 text-[var(--muted)]">Error loading queue stats.</div>
      )}

      {/* Custom Confirm Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}></div>
          <div className="glass-card p-8 max-w-md w-full relative z-10 animate-in zoom-in-95 duration-200">
            <h3 className="text-2xl font-serif text-[var(--text)] mb-4">{confirmModal.title}</h3>
            <p className="text-[var(--muted-light)] mb-8 font-sans leading-relaxed text-sm">
              {confirmModal.message}
            </p>
            <div className="flex gap-4">
              <button 
                onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                className="flex-1 btn-secondary py-3 font-mono text-xs uppercase tracking-widest"
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirmAction}
                className={`flex-1 py-3 font-mono text-xs uppercase tracking-widest rounded-xl text-black font-semibold transition-all ${
                  confirmModal.type === 'rebalance' 
                    ? 'bg-[var(--danger)] hover:bg-[#ff7a7a] shadow-[0_4px_24px_rgba(255,90,90,0.15)]' 
                    : 'btn-primary'
                }`}
              >
                {confirmModal.actionLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Notification Modal */}
      {notificationModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setNotificationModal({ ...notificationModal, isOpen: false })}></div>
          <div className="glass-card p-8 max-w-sm w-full text-center relative z-10 animate-in zoom-in-95 duration-200">
            <div className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-6 ${
              notificationModal.type === 'success' 
                ? 'bg-[rgba(0,196,140,0.1)] border border-[rgba(0,196,140,0.2)] text-[var(--success)]' 
                : 'bg-[rgba(255,90,90,0.1)] border border-[rgba(255,90,90,0.2)] text-[var(--danger)]'
            }`}>
              <AlertCircle className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-serif text-[var(--text)] mb-2">{notificationModal.title}</h3>
            <p className="text-[var(--muted-light)] mb-8 font-sans text-sm">
              {notificationModal.message}
            </p>
            <button 
              onClick={() => setNotificationModal({ ...notificationModal, isOpen: false })}
              className="w-full btn-secondary py-3 font-mono text-xs uppercase tracking-widest"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
