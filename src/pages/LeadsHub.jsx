import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Search, LayoutGrid, List, Phone, MessageCircle, AlertTriangle, Globe, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { buildWhatsAppLink } from '../utils/whatsapp';
import { exportLeadsAsCSV } from '../utils/exportCSV';
import LeadDrawer from '../components/Leads/LeadDrawer';
import KanbanBoard from '../components/Leads/KanbanBoard';
import { notify, notifyError } from '../lib/notify';
import { cleanSearchTerm } from '../lib/leads';
import { STAGES, stageLabel, stageColor } from '../utils/pipeline';
import useMediaQuery from '../utils/useMediaQuery';

const PAGE_SIZE = 50;

const SORTS = {
  newest: { label: 'Newest', column: 'created_at', ascending: false },
  score: { label: 'Best Score', column: 'ai_score', ascending: false },
  next_call: { label: 'Longest Since Call', column: 'last_called_at', ascending: true, nullsFirst: true },
  name: { label: 'Name A-Z', column: 'name', ascending: true },
};

export default function LeadsHub({ defaultView = 'table' }) {
  const location = useLocation();
  const navigate = useNavigate();
const isMobile = useMediaQuery('(max-width: 767px)');
const searchParams = new URLSearchParams(location.search);
  const autoStart = searchParams.get('start') === 'true';

  const user = JSON.parse(localStorage.getItem('crm_user') || '{}');
  const [leads, setLeads] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
const [phoneStatusFilter, setPhoneStatusFilter] = useState('has_phone');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [sortBy, setSortBy] = useState(defaultView === 'queue' ? 'next_call' : 'newest');
  const [page, setPage] = useState(0);
  const [boardRefresh, setBoardRefresh] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
const [listFilter, setListFilter] = useState(searchParams.get('list_id') || 'all');
  const [activeTab, setActiveTab] = useState(defaultView === 'queue' ? 'my_queue' : 'all_leads');
  const [loading, setLoading] = useState(true);
  const [queueStats, setQueueStats] = useState(null);
  const [leadLists, setLeadLists] = useState([]);
  
  const [viewMode, setViewMode] = useState(defaultView);
const [selectedLeadDrawerId, setSelectedLeadDrawerId] = useState(null);
const [showExportConfirm, setShowExportConfirm] = useState(false);

  const isAdmin = user.role === 'admin';
  const adminView = isAdmin && (localStorage.getItem('crm_view_mode') || 'admin') === 'admin';
  // The board shows one person's deals unless an admin is looking across the team
  const boardOwnerId = adminView ? (ownerFilter === 'all' ? null : ownerFilter) : user.id;

  const openDrawer = (e, id) => {
    // Prevent opening if clicking a button or checkbox or input
    if (e?.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON' || e.target.closest('button'))) return;
setSelectedLeadDrawerId(id);
  };

  const handleAction = (lead, action) => {
    if (action === 'call') {
      if (!lead.phone) return;
      window.location.href = `tel:${lead.phone}`;
      setSelectedLeadDrawerId(lead.id);
    } else if (action === 'whatsapp') {
      if (!lead.phone) return;
      const link = buildWhatsAppLink(lead.phone, lead.name);
      window.open(link, '_blank');
      setSelectedLeadDrawerId(lead.id);
    }
  };

  const checkDuplicate = (lead) => {
    return leads.some(l => 
      l.id !== lead.id && 
      ((l.phone && lead.phone && l.phone === lead.phone) || 
       (l.name && lead.name && l.name.toLowerCase() === lead.name.toLowerCase()))
    );
  };

  // Inline Note Editing
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [noteValue, setNoteValue] = useState('');

  const handleNoteBlur = async (leadId) => {
    try {
      const { error } = await supabase.from('leads').update({ notes: noteValue }).eq('id', leadId);
      if (error) throw error;
      setEditingNoteId(null);
      fetchLeads();
    } catch (err) {
      notifyError(err, 'Could not save this note.');
}
  };

  const wasCalledToday = (lead) => {
    if (!lead.last_called_at) return false;
    const today = new Date().toDateString();
    return new Date(lead.last_called_at).toDateString() === today;
  };

  // Bulk Assign State
  const [selectedLeads, setSelectedLeads] = useState(new Set());
  const [users, setUsers] = useState([]);
  const [bulkAssignUser, setBulkAssignUser] = useState('');

  useEffect(() => {
    setViewMode(defaultView);
  }, [defaultView]);

  const fetchUsers = async () => {
    try {
      const { data } = await supabase.from('profiles').select('*');
      if (data) setUsers(data);
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  const buildLeadsQuery = (columns, options) => {
    let query = supabase.from('leads').select(columns, options);

    const term = cleanSearchTerm(search);
    if (term) {
      query = query.or(`name.ilike.%${term}%,phone.ilike.%${term}%`);
    }
    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }
    if (listFilter !== 'all') {
      query = query.eq('list_id', listFilter);
    }
    if (phoneStatusFilter === 'has_phone') {
      query = query.not('phone', 'is', null).neq('phone', '');
    } else if (phoneStatusFilter === 'missing_phone') {
      query = query.or('phone.is.null,phone.eq.');
    }
    if (ownerFilter !== 'all') {
      query = query.eq('assigned_to', ownerFilter);
    }
    if (activeTab === 'my_queue') {
      query = query.eq('assigned_to', user.id).not('status', 'in', '(won,lost)');
    } else if (activeTab === 'today_queue') {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      query = query.eq('assigned_to', user.id).not('status', 'in', '(won,lost)')
        .or(`last_called_at.is.null,last_called_at.lt.${startOfToday.toISOString()}`);
    } else if (activeTab === 'unassigned') {
      query = query.is('assigned_to', null);
    }
    return query;
  };

  const fetchLeads = async () => {
    if (viewMode === 'kanban') return;
    setLoading(true);
    try {
      const sort = SORTS[sortBy];
      const { data, count, error } = await buildLeadsQuery('*, profiles(name)', { count: 'exact' })
        .order(sort.column, { ascending: sort.ascending, nullsFirst: sort.nullsFirst ?? false })
        .order('id', { ascending: true })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      if (error) throw error;

      const formattedLeads = data.map(l => ({ ...l, owner_name: l.profiles?.name }));
      setLeads(formattedLeads);
      setTotal(count || 0);

      if (formattedLeads.length === 0 && activeTab === 'my_queue') {
        const { data: stats } = await supabase.rpc('dashboard_stats', {
          p_tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
          p_view: 'agent'
        });
        const me = stats?.team?.find(u => u.id === user.id);
        setQueueStats({
          completed: me?.completed || 0,
          interested: me?.interested || 0,
          meetings: me?.meetings || 0,
          followUps: (stats?.followUps?.dueNow || 0) + (stats?.followUps?.overdue || 0),
        });
      }
    } catch (err) {
      notifyError(err, 'Could not load leads.');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      // The API returns at most 1000 rows per request, so walk through every page
      const rows = [];
      const batchSize = 1000;
      for (let from = 0; ; from += batchSize) {
        const { data, error } = await buildLeadsQuery('*').order('id').range(from, from + batchSize - 1);
        if (error) throw error;
        rows.push(...data);
        if (data.length < batchSize) break;
      }
      exportLeadsAsCSV(rows, `leads-${new Date().toISOString().split('T')[0]}.csv`);
      notify(`Exported ${rows.length} leads.`);
      setShowExportConfirm(false);
    } catch (err) {
      notifyError(err, 'Could not export leads.');
    } finally {
      setIsExporting(false);
    }
  };

  const fetchLeadLists = async () => {
    try {
      const { data } = await supabase.from('lead_lists').select('*');
      if (data) setLeadLists(data);
    } catch (err) {
      console.error('Error fetching lists:', err);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchLeadLists();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchLeads();
    }, 300);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only when a filter changes
  }, [search, statusFilter, phoneStatusFilter, ownerFilter, sortBy, page, listFilter, activeTab, viewMode]);

  // Any filter change starts again from the first page
  useEffect(() => {
    setPage(0);
    setSelectedLeads(new Set());
  }, [search, statusFilter, phoneStatusFilter, ownerFilter, sortBy, listFilter, activeTab]);

  useEffect(() => {
    const refresh = () => {
      fetchLeads();
      setBoardRefresh(n => n + 1);
    };
    window.addEventListener('crm:leadCreated', refresh);
    return () => window.removeEventListener('crm:leadCreated', refresh);
  });

  useEffect(() => {
    if (autoStart && leads.length > 0 && !selectedLeadDrawerId) {
      setSelectedLeadDrawerId(leads[0].id);
      window.history.replaceState({}, '', window.location.pathname);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- auto-open only when leads arrive
  }, [leads, autoStart]);

  const toggleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedLeads(new Set(leads.map(l => l.id)));
    } else {
      setSelectedLeads(new Set());
    }
  };

  const toggleSelectLead = (id) => {
    const newSet = new Set(selectedLeads);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedLeads(newSet);
  };

  const handleBulkAssign = async () => {
    if (!bulkAssignUser) return notify('Select a user to assign to.', 'error');
    try {
      const { error } = await supabase.from('leads').update({ assigned_to: bulkAssignUser, assigned_date: new Date().toISOString() }).in('id', Array.from(selectedLeads));
      if (error) throw error;
setSelectedLeads(new Set());
      setBulkAssignUser('');
      fetchLeads();
    } catch (err) {
      notifyError(err, 'Error assigning leads.');
    }
  };

  const handleNextLead = () => {
    if (!selectedLeadDrawerId) return;

    const activeSubset = leads;

    const currentIndex = activeSubset.findIndex(l => l.id === selectedLeadDrawerId);
    if (currentIndex >= 0 && currentIndex < activeSubset.length - 1) {
      setSelectedLeadDrawerId(activeSubset[currentIndex + 1].id);
      fetchLeads();
    } else {
      setSelectedLeadDrawerId(null);
      fetchLeads();
    }
  };

  const renderStatusBadge = (status) => (
    <span
      className="pill-tag bg-[rgba(255,255,255,0.04)] border border-[var(--border-subtle)]"
      style={{ color: stageColor(status) }}
    >
      {stageLabel(status)}
    </span>
  );

  const renderWebsiteBadge = (status) => {
    if (!status || status === 'not_checked') return null;
    const map = {
      'no_website': { color: 'text-[var(--danger)]', bg: 'bg-[rgba(255,90,90,0.1)]', border: 'border-[rgba(255,90,90,0.2)]', label: 'No Website' },
      'needs_redesign': { color: 'text-[var(--warning)]', bg: 'bg-[rgba(247,185,85,0.1)]', border: 'border-[rgba(247,185,85,0.2)]', label: 'Needs Redesign' },
      'modern_website': { color: 'text-[var(--success-emerald)]', bg: 'bg-[rgba(0,196,140,0.1)]', border: 'border-[rgba(0,196,140,0.2)]', label: 'Modern Website' }
    };
    const s = map[status];
    if (!s) return null;
    return (
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono border ${s.color} ${s.bg} ${s.border}`}>
        <Globe className="w-2.5 h-2.5" /> {s.label}
      </span>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12 relative">
      
      {/* Header and Controls */}
      <div className="flex flex-col gap-4 mb-2">
        {/* Tab Navigation */}
        {viewMode !== 'kanban' && <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-2">
          {[
            { id: 'my_queue', label: 'My Queue' },
            { id: 'today_queue', label: "Today's Queue" },
            { id: 'follow_ups', label: 'Follow Ups' },
            ...(isAdmin ? [{ id: 'unassigned', label: 'Unassigned' }] : []),
            ...(isAdmin ? [{ id: 'all_leads', label: 'All Leads' }] : [])
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => tab.id === 'follow_ups' ? navigate('/outreach/follow-ups') : setActiveTab(tab.id)}
className={`px-4 py-2 rounded-xl text-xs font-mono uppercase tracking-widest transition-colors whitespace-nowrap ${
                activeTab === tab.id 
                  ? 'bg-[var(--accent)] text-[#050505] shadow-[0_4px_12px_rgba(200,180,138,0.25)]' 
                  : 'bg-[rgba(255,255,255,0.02)] text-[var(--muted-light)] hover:text-[var(--text)] border border-[var(--border-subtle)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>}

        <div className="card-primitive p-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h1 className="text-3xl heading-serif text-[var(--text)]">Leads {viewMode === 'kanban' ? 'Pipeline' : 'List'}</h1>
            <p className="text-[11px] font-mono uppercase tracking-widest text-[var(--muted-light)] mt-2">
              {viewMode === 'kanban'
                ? (isMobile ? 'Tap a deal to change its stage' : 'Drag a deal to move it to the next stage')
                : `Manage your ${total} leads`}
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
            <input 
              type="text" 
              placeholder="Search leads..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl text-sm text-[var(--text)] focus:outline-none placeholder-[var(--muted)]"
              style={{
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-subtle)',
              }}
            />
          </div>

          <select 
            value={listFilter}
            onChange={(e) => setListFilter(e.target.value)}
            className="rounded-xl px-4 py-2 text-xs font-mono uppercase text-[var(--muted-light)] focus:outline-none"
            style={{
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <option value="all">List: All Lists</option>
            {leadLists.map(list => (
              <option key={list.id} value={list.id}>{list.name}</option>
            ))}
          </select>
          
          {adminView && (
            <select
              aria-label="Filter by owner"
              value={ownerFilter}
              onChange={(e) => setOwnerFilter(e.target.value)}
              className="rounded-xl px-4 py-2 text-xs font-mono uppercase text-[var(--muted-light)] focus:outline-none"
              style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)' }}
            >
              <option value="all">Owner: Everyone</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
            </select>
          )}

          {viewMode !== 'kanban' && (
            <>
              <select
                aria-label="Filter by stage"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-xl px-4 py-2 text-xs font-mono uppercase text-[var(--muted-light)] focus:outline-none"
                style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)' }}
              >
                <option value="all">Stage: All</option>
                {STAGES.map(st => <option key={st.key} value={st.key}>{st.label}</option>)}
              </select>

              <select
                aria-label="Filter by phone"
                value={phoneStatusFilter}
                onChange={(e) => setPhoneStatusFilter(e.target.value)}
                className="rounded-xl px-4 py-2 text-xs font-mono uppercase text-[var(--muted-light)] focus:outline-none"
                style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)' }}
              >
                <option value="all">Phone: All</option>
                <option value="has_phone">Has Phone Number</option>
                <option value="missing_phone">Missing Phone Number</option>
              </select>

              <select
                aria-label="Sort leads"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="rounded-xl px-4 py-2 text-xs font-mono uppercase text-[var(--muted-light)] focus:outline-none"
                style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)' }}
              >
                {Object.entries(SORTS).map(([key, sort]) => <option key={key} value={key}>Sort: {sort.label}</option>)}
              </select>
            </>
          )}

          <div className="flex items-center gap-3">
            <div className="flex p-1 rounded-xl" style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)' }}>
              <button 
                aria-label="List view"
                onClick={() => setViewMode('table')}
className={`p-1.5 rounded-lg transition-colors ${viewMode !== 'kanban' ? 'bg-[var(--accent-dim)] text-[var(--accent-blue)]' : 'text-[var(--muted-light)] hover:text-[var(--text)]'}`}
              >
                <List className="w-4 h-4" />
              </button>
              <button 
                aria-label="Pipeline view"
                onClick={() => setViewMode('kanban')}
className={`p-1.5 rounded-lg transition-colors ${viewMode === 'kanban' ? 'bg-[var(--accent-dim)] text-[var(--accent-blue)]' : 'text-[var(--muted-light)] hover:text-[var(--text)]'}`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
            
            <button 
              onClick={() => setShowExportConfirm(true)}
              className="btn-secondary px-4 py-2 text-xs font-mono uppercase tracking-widest flex items-center gap-2"
            >
              Export CSV
            </button>
            <button 
              onClick={() => window.dispatchEvent(new Event('crm:openCreateLead'))}
              className="btn-primary px-4 py-2 text-xs font-mono uppercase tracking-widest"
            >
              + Add Lead
            </button>
            {isAdmin && (
              <button
                onClick={() => navigate('/leads/import')}
                className="btn-secondary px-4 py-2 text-xs font-mono uppercase tracking-widest"
              >
                Import Leads
              </button>
            )}
</div>
        </div>
      </div>
      </div>

      {viewMode === 'kanban' ? (
        <KanbanBoard
          search={search}
          listFilter={listFilter}
          ownerId={boardOwnerId}
          refreshKey={boardRefresh}
          onOpenLead={setSelectedLeadDrawerId}
        />
      ) : loading ? (
        <div className="flex justify-center items-center py-32">
          <div className="animate-pulse text-[var(--accent-blue)] font-medium tracking-tight text-xl">Loading leads...</div>
        </div>
      ) : leads.length === 0 ? (
        activeTab === 'my_queue' && !search && statusFilter === 'all' && listFilter === 'all' ? (
          <div className="text-center py-24 card-primitive max-w-2xl mx-auto">
            <h3 className="text-4xl font-medium tracking-tight text-[var(--success-emerald)] mb-2">🎯 Queue Completed</h3>
            <p className="text-[var(--muted)] font-mono text-xs uppercase tracking-widest mb-10">Excellent work! You've cleared your queue.</p>
            
            {queueStats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
                  <div className="bg-[rgba(255,255,255,0.02)] border border-[var(--bg-surface-highlight)] rounded-2xl p-4">
                    <p className="text-[10px] font-mono uppercase text-[var(--muted-light)] mb-1 tracking-widest">Total Calls</p>
                    <p className="text-3xl font-medium tracking-tight text-[var(--text)]">{queueStats.completed}</p>
                  </div>
                  <div className="bg-[rgba(0,196,140,0.05)] border border-[rgba(0,196,140,0.1)] rounded-2xl p-4">
                    <p className="text-[10px] font-mono uppercase text-[var(--success-emerald)] opacity-70 mb-1 tracking-widest">Interested</p>
                    <p className="text-3xl font-medium tracking-tight text-[var(--success-emerald)]">{queueStats.interested}</p>
                  </div>
                  <div className="bg-[rgba(139,92,246,0.05)] border border-[rgba(139,92,246,0.1)] rounded-2xl p-4">
                    <p className="text-[10px] font-mono uppercase text-[#8B5CF6] opacity-70 mb-1 tracking-widest">Meetings</p>
                    <p className="text-3xl font-medium tracking-tight text-[#8B5CF6]">{queueStats.meetings}</p>
                  </div>
                  <div className="bg-[rgba(247,185,85,0.05)] border border-[rgba(247,185,85,0.1)] rounded-2xl p-4">
                    <p className="text-[10px] font-mono uppercase text-[var(--warning)] opacity-70 mb-1 tracking-widest">Follow-Ups</p>
                    <p className="text-3xl font-medium tracking-tight text-[var(--warning)]">{queueStats.followUps}</p>
                  </div>
                </div>
            )}

            <button 
              onClick={() => navigate('/dashboard')}
              className="btn-primary px-8 py-4 font-mono text-sm uppercase tracking-widest"
            >
              Back To Dashboard
            </button>
          </div>
        ) : (
          <div className="text-center py-24 card-primitive">
            <p className="text-[var(--muted)] font-mono text-sm uppercase tracking-widest mb-2">No Leads Found</p>
            <p className="text-[var(--muted-light)] text-sm">Try adjusting your filters or search query.</p>
          </div>
        )
      ) : (
        <>
        <div className="hidden md:block">
        {/* TABLE VIEW */}
        <div className="card-primitive overflow-hidden rounded-2xl">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead style={{ background: 'rgba(5, 5, 5, 0.6)', borderBottom: '1px solid var(--border-subtle)' }}>
                <tr>
                  <th className="px-6 py-4 w-12">
                    <input
                      type="checkbox"
                      aria-label="Select all leads on this page"
                      className="accent-[var(--accent)] w-4 h-4 rounded"
                      onChange={toggleSelectAll}
                      checked={leads.length > 0 && selectedLeads.size === leads.length}
                    />
                  </th>
                  <th className="px-6 py-4 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Company</th>
                  <th className="px-6 py-4 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Owner</th>
                  <th className="px-6 py-4 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Contact Info</th>
                  <th className="px-6 py-4 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Status</th>
                  <th className="px-6 py-4 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Notes</th>
                  <th className="px-6 py-4 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)] text-right">Outreach</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(200,180,138,0.04)]">
                {leads.map(lead => (
                  <tr 
                    key={lead.id} 
                    className={`transition-colors group cursor-pointer ${
                      wasCalledToday(lead)
                        ? 'opacity-60 bg-[rgba(255,255,255,0.01)] hover:opacity-100'
                        : 'hover:bg-[rgba(255,255,255,0.02)]'
                    }`}
                    onClick={(e) => openDrawer(e, lead.id)}
                  >
                    <td className="px-6 py-4">
                      <input 
                        type="checkbox" 
                        className="accent-[var(--accent)] w-4 h-4 rounded"
                        checked={selectedLeads.has(lead.id)}
                        onChange={() => toggleSelectLead(lead.id)}
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <p className="font-medium tracking-tight text-lg text-[var(--text)] truncate max-w-[250px]">{lead.name}</p>
                        {wasCalledToday(lead) && (
                          <span title="Called today" className="text-[var(--success-emerald)] text-[10px] font-mono">✓ called</span>
                        )}
                        {checkDuplicate(lead) && (
                          <span className="flex items-center gap-1 text-[var(--warning)] text-[10px] font-mono bg-[rgba(247,185,85,0.1)] px-2 py-0.5 rounded border border-[rgba(247,185,85,0.2)]">
                            <AlertTriangle className="w-3 h-3"/> Possible Duplicate
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-xs font-mono text-[var(--muted)] truncate max-w-[200px]">{lead.location || 'Unknown Location'}</p>
                        {renderWebsiteBadge(lead.website_status)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-[var(--bg-surface-elevated)] border border-[var(--border-strong)] text-[var(--text-secondary)] font-medium flex items-center justify-center text-[8px] font-medium tracking-tight text-[var(--accent-blue)]">
                          {lead.owner_name ? lead.owner_name.charAt(0) : '?'}
                        </div>
                        <span className={`text-xs font-mono uppercase tracking-widest ${lead.owner_name ? 'text-[var(--text)]' : 'text-[var(--muted-light)]'}`}>
                          {lead.owner_name || 'Unassigned'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-mono text-[var(--text)]">{lead.phone || '-'}</p>
                    </td>
                    <td className="px-6 py-4">{renderStatusBadge(lead.status)}</td>
                    <td 
                      className="px-6 py-4"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingNoteId(lead.id);
                        setNoteValue(lead.notes || '');
                      }}
                    >
                      {editingNoteId === lead.id ? (
                        <input
                          autoFocus
                          value={noteValue}
                          onChange={e => setNoteValue(e.target.value)}
                          onBlur={() => handleNoteBlur(lead.id)}
                          onKeyDown={e => e.key === 'Enter' && handleNoteBlur(lead.id)}
                          className="bg-transparent border-b border-[var(--accent)] text-xs text-[var(--text)] w-full outline-none py-1 font-mono"
                          placeholder="Add a note..."
                        />
                      ) : (
                        <span className="text-[var(--muted-light)] text-xs font-mono cursor-pointer hover:text-[var(--text)] transition-colors truncate max-w-[150px] block">
                          {lead.notes || '+ Add note'}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-30 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleAction(lead, 'call')}
                          disabled={!lead.phone}
                          className={`p-2 rounded-lg transition-all ${lead.phone ? 'hover:text-[var(--accent-blue)] cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}
                          style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)' }}
                          title={lead.phone ? "Call" : "No Phone Number"}
                        >
                          <Phone className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleAction(lead, 'whatsapp')}
                          disabled={!lead.phone}
                          className={`p-2 rounded-lg transition-all ${lead.phone ? 'hover:text-[#25D366] cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}
                          style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)' }}
                          title={lead.phone ? "WhatsApp" : "No Phone Number"}
                        >
                          <MessageCircle className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </div>
        
        {/* MOBILE VIEW */}
        <div className="md:hidden">
          {/* Mobile Cards */}
          <div className="flex flex-col gap-3">
            {leads.map(lead => (
              <motion.div 
                key={lead.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={(e) => openDrawer(e, lead.id)}
                className={`p-4 rounded-2xl border border-[rgba(200,180,138,0.1)] transition-colors relative overflow-hidden ${
                  wasCalledToday(lead) 
                    ? 'bg-[rgba(255,255,255,0.02)] opacity-70' 
                    : 'bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)]'
                }`}
              >
                {wasCalledToday(lead) && (
                  <div className="absolute top-0 left-0 w-1 h-full bg-[var(--success-emerald)]"></div>
                )}
                <div className="flex justify-between items-start mb-2">
                  <div className="pr-2 max-w-[70%]">
                    <h3 className="font-medium tracking-tight text-[var(--text)] text-lg leading-tight truncate">{lead.name}</h3>
                    <p className="text-[11px] font-mono text-[var(--muted-light)] mt-1 truncate">{lead.location || 'Unknown Location'}</p>
                  </div>
                  <div>{renderStatusBadge(lead.status)}</div>
                </div>
                
                <div className="flex justify-between items-end mt-3">
                  <div>
                    <p className="font-mono text-[var(--text)] text-sm">{lead.phone || 'No phone'}</p>
                    <div className="mt-1 flex gap-2">
                      {renderWebsiteBadge(lead.website_status)}
                    </div>
                  </div>
                  
                  <div className="flex gap-2.5">
                    <button 
                      onClick={(e) => { e.stopPropagation(); if(lead.phone) window.location.href = `tel:${lead.phone}`; }}
                      disabled={!lead.phone}
                      className={`w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-90 ${lead.phone ? 'bg-[var(--accent)] text-black shadow-lg shadow-[var(--border-strong)]' : 'bg-[var(--bg-surface-highlight)] text-[var(--muted)]'}`}
                    >
                      <Phone className="w-5 h-5" strokeWidth={2.5} />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); if(lead.phone) window.open(buildWhatsAppLink(lead.phone, lead.name), '_blank'); }}
                      disabled={!lead.phone}
                      className={`w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-90 ${lead.phone ? 'bg-[#25D366] text-white shadow-lg shadow-[#25D366]/20' : 'bg-[var(--bg-surface-highlight)] text-[var(--muted)]'}`}
                    >
                      <MessageCircle className="w-5 h-5" strokeWidth={2.5} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between gap-4 pt-2">
            <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted)]">
              {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
            </p>
            <div className="flex gap-2">
              <button
                aria-label="Previous page"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
                className="btn-secondary p-2 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                aria-label="Next page"
                disabled={(page + 1) * PAGE_SIZE >= total}
                onClick={() => setPage(page + 1)}
                className="btn-secondary p-2 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
        </>
)}

      {/* Floating Bulk Assign Action Bar */}
      {selectedLeads.size > 0 && isAdmin && viewMode !== 'kanban' && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 card-primitive px-8 py-5 z-40 flex items-center gap-6 animate-in slide-in-from-bottom-10"
          style={{ border: '1px solid rgba(200, 180, 138, 0.20)', boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 40px var(--border-subtle)' }}
        >
          <div className="flex flex-col">
            <span className="text-[var(--text)] font-medium tracking-tight text-2xl">{selectedLeads.size} Selected</span>
            <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted)]">Ready for assignment</span>
          </div>
          
          <div className="w-[1px] h-10 bg-[var(--border-subtle)] mx-2"></div>
          
          <select 
            value={bulkAssignUser} 
            onChange={e => setBulkAssignUser(e.target.value)}
            className="rounded-xl px-4 py-3 text-sm font-mono uppercase tracking-widest focus:outline-none text-[var(--text)]"
            style={{ background: 'var(--bg-surface-elevated)', border: '1px solid rgba(200,180,138,0.10)' }}
          >
            <option value="">Select Team Member...</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name} (Target: {u.daily_target})</option>)}
          </select>
          
          <button 
            onClick={handleBulkAssign} 
            className="btn-primary px-8 py-3 font-mono uppercase tracking-[0.2em]"
          >
            Assign Leads
          </button>
        </div>
      )}



      {/* Lead Drawer Component */}
      {selectedLeadDrawerId && (
        <LeadDrawer 
          leadId={selectedLeadDrawerId} 
          onClose={() => {
            setSelectedLeadDrawerId(null);
            fetchLeads();
            setBoardRefresh(n => n + 1);
          }}
          onNext={viewMode === 'kanban' ? undefined : handleNextLead}
        />
      )}

      {/* Export confirmation */}
      {showExportConfirm && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/70" onClick={() => setShowExportConfirm(false)}>
          <div role="dialog" aria-label="Export leads" onClick={e => e.stopPropagation()} className="card-primitive w-full max-w-sm p-6 space-y-5">
            <div>
              <h3 className="text-xl heading-serif text-[var(--text)]">Export leads to CSV?</h3>
              <p className="text-sm text-[var(--muted-light)] mt-2">
                This downloads every lead matching your current filters{viewMode === 'kanban' ? '' : ` (${total})`}, including phone numbers.
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowExportConfirm(false)} className="btn-secondary flex-1 py-3 text-xs font-mono uppercase tracking-widest">Cancel</button>
              <button onClick={handleExport} disabled={isExporting} className="btn-primary flex-1 py-3 text-xs font-mono uppercase tracking-widest disabled:opacity-50">
                {isExporting ? 'Exporting...' : 'Export'}
              </button>
            </div>
          </div>
        </div>
      )}
</div>
  );
}
