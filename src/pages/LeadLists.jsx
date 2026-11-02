import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Search, FolderOpen, Trash, Users, Plus, ChevronRight, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { notify } from '../lib/notify';

export default function LeadLists() {
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newListData, setNewListData] = useState({ name: '', category: '', description: '' });
  
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingList, setDeletingList] = useState(null);
  
  const navigate = useNavigate();

  const userStr = localStorage.getItem('crm_user');
  const user = userStr ? JSON.parse(userStr) : null;
  const isAdmin = user?.role === 'admin';

  const fetchLists = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('lead_list_stats');
      if (error) throw error;
      setLists(data || []);
} catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLists();
  }, []);

  const handleCreateList = async (e) => {
    e.preventDefault();
    if (!newListData.name) return;
    try {
      const { error } = await supabase.from('lead_lists').insert([{
        name: newListData.name,
        category: newListData.category,
        description: newListData.description,
        uploaded_by: user.id
      }]);
      
      if (error) throw error;
      
      setShowCreateModal(false);
      setNewListData({ name: '', category: '', description: '' });
      fetchLists();
    } catch (err) {
      notify('Failed to create list: ' + err.message, 'error');
    }
  };

  const confirmDelete = async (withLeads) => {
    try {
      if (withLeads) {
        // Cascade delete will handle leads automatically if FK constraint is ON DELETE CASCADE
        // Just delete the list
      }
      const { error } = await supabase.from('lead_lists').delete().eq('id', deletingList.id);
      
      if (error) throw error;
      
      setShowDeleteModal(false);
      setDeletingList(null);
      fetchLists();
    } catch (err) {
      notify('Failed to delete list: ' + err.message, 'error');
    }
  };

  const filteredLists = lists.filter(l => 
    l.name.toLowerCase().includes(search.toLowerCase()) || 
    (l.category && l.category.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      <div className="glass-card p-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl heading-serif text-[var(--text)]">Lead Lists</h1>
          <p className="text-[11px] font-mono uppercase tracking-widest text-[var(--muted-light)] mt-2">Manage lead lists and campaigns</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
            <input 
              type="text" 
              placeholder="Search lists..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl text-sm text-[var(--text)] focus:outline-none placeholder-[var(--muted)]"
              style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(200, 180, 138, 0.08)' }}
            />
          </div>
          {isAdmin && (
            <button onClick={() => setShowCreateModal(true)} className="btn-primary flex items-center gap-2 py-2 px-4">
              <Plus className="w-4 h-4" /> New List
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-32">
          <div className="animate-pulse text-[var(--accent)] font-serif text-xl">Loading lists...</div>
        </div>
      ) : filteredLists.length === 0 ? (
        <div className="text-center py-24 glass-card">
          <FolderOpen className="w-12 h-12 mx-auto text-[var(--muted)] mb-4" />
          <p className="text-[var(--muted)] font-mono text-sm uppercase tracking-widest mb-2">No Lists Found</p>
          <p className="text-[var(--muted-light)] text-sm">Create a list or upload a CSV to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredLists.map(list => (
            <div key={list.id} className="glass-card group hover:border-[var(--accent)] transition-colors duration-300 flex flex-col relative overflow-hidden">
              <div className="p-6 flex-1">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-serif text-[var(--text)]">{list.name}</h3>
                    <p className="text-xs font-mono text-[var(--accent)] mt-1 tracking-widest uppercase">{list.category}</p>
                  </div>
                  {isAdmin && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); setDeletingList(list); setShowDeleteModal(true); }}
                      className="p-2 rounded hover:bg-[rgba(255,90,90,0.1)] text-[var(--muted-light)] hover:text-[var(--danger)] transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash className="w-4 h-4" />
                    </button>
                  )}
                </div>
                
                {list.description && (
                  <p className="text-sm text-[var(--muted-light)] line-clamp-2 mb-6">{list.description}</p>
                )}

                <div className="grid grid-cols-3 gap-2 mt-auto pt-4 border-t border-[rgba(200,180,138,0.06)]">
                  <div>
                    <p className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-wider mb-1">Total</p>
                    <p className="text-lg font-serif text-[var(--text)]">{list.total_leads || 0}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-wider mb-1">Assigned</p>
                    <p className="text-lg font-serif text-[var(--warning)]">{list.assigned_leads || 0}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-wider mb-1">Pool</p>
                    <p className="text-lg font-serif text-[var(--success)]">{list.unassigned_leads || 0}</p>
                  </div>
                </div>
              </div>
              
              <div className="flex border-t border-[rgba(200,180,138,0.06)] bg-[rgba(0,0,0,0.2)]">
                <button 
                  onClick={() => navigate(`/leads/database?list_id=${list.id}`)}
                  className="flex-1 p-3 flex items-center justify-center gap-2 text-xs font-mono uppercase tracking-widest text-[var(--muted-light)] hover:text-[var(--text)] hover:bg-[rgba(255,255,255,0.02)] transition-colors border-r border-[rgba(200,180,138,0.06)]"
                >
                  <Users className="w-4 h-4" /> View Leads
                </button>
                <button 
                  onClick={() => navigate(`/leads/pipeline?list_id=${list.id}`)}
                  className="flex-1 p-3 flex items-center justify-center gap-2 text-xs font-mono uppercase tracking-widest text-[var(--muted-light)] hover:text-[var(--accent)] hover:bg-[rgba(255,255,255,0.02)] transition-colors"
                >
                  Pipeline <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="glass-card p-6 w-full max-w-md animate-in zoom-in-95" style={{ border: '1px solid rgba(200,180,138,0.2)' }}>
            <h2 className="text-2xl font-serif text-[var(--text)] mb-6">Create Lead List</h2>
            <form onSubmit={handleCreateList} className="space-y-4">
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] mb-2">List Name</label>
                <input 
                  type="text" required
                  value={newListData.name} onChange={e => setNewListData({...newListData, name: e.target.value})}
                  className="w-full bg-[rgba(255,255,255,0.03)] border border-[rgba(200,180,138,0.08)] rounded-xl p-3 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                  placeholder="e.g. Dentists Kerala"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] mb-2">Category (Optional)</label>
                <input 
                  type="text" 
                  value={newListData.category} onChange={e => setNewListData({...newListData, category: e.target.value})}
                  className="w-full bg-[rgba(255,255,255,0.03)] border border-[rgba(200,180,138,0.08)] rounded-xl p-3 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                  placeholder="e.g. Dental"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] mb-2">Description (Optional)</label>
                <textarea 
                  value={newListData.description} onChange={e => setNewListData({...newListData, description: e.target.value})}
                  className="w-full h-24 bg-[rgba(255,255,255,0.03)] border border-[rgba(200,180,138,0.08)] rounded-xl p-3 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--accent)] custom-scrollbar"
                  placeholder="e.g. Outreach campaign for Q3..."
                />
              </div>
              <div className="flex gap-3 pt-4 border-t border-[rgba(200,180,138,0.08)]">
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn-secondary flex-1 py-3 text-xs">
                  Cancel
                </button>
                <button type="submit" className="btn-primary flex-1 py-3 text-xs">
                  Create List
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && deletingList && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="glass-card p-6 w-full max-w-md animate-in zoom-in-95" style={{ border: '1px solid rgba(255,90,90,0.2)' }}>
            <div className="flex items-center gap-3 text-[var(--danger)] mb-4">
              <AlertTriangle className="w-6 h-6" />
              <h2 className="text-xl font-serif">Delete List</h2>
            </div>
            
            <p className="text-sm text-[var(--text)] mb-2">
              You are about to delete <strong>{deletingList.name}</strong>.
            </p>
            <p className="text-xs text-[var(--muted-light)] mb-6">
              This list contains <strong>{deletingList.total_leads || 0}</strong> leads. You can choose to either delete the list container only (the leads will remain in your global database without a list) OR permanently delete the list and all associated leads.
            </p>

            <div className="space-y-3">
              <button onClick={() => confirmDelete(false)} className="w-full p-4 rounded-xl border border-[rgba(200,180,138,0.2)] bg-[rgba(200,180,138,0.05)] hover:bg-[rgba(200,180,138,0.1)] text-left transition-colors">
                <div className="font-mono text-sm text-[var(--text)] uppercase tracking-wider mb-1">Delete List Only</div>
                <div className="text-xs text-[var(--muted-light)]">Keep all {deletingList.total_leads || 0} leads in the global database.</div>
              </button>

              <button onClick={() => confirmDelete(true)} className="w-full p-4 rounded-xl border border-[rgba(255,90,90,0.3)] bg-[rgba(255,90,90,0.05)] hover:bg-[rgba(255,90,90,0.1)] text-left transition-colors">
                <div className="font-mono text-sm text-[var(--danger)] uppercase tracking-wider mb-1">Delete List & All Leads</div>
                <div className="text-xs text-[var(--muted-light)]">Permanently delete {deletingList.total_leads || 0} leads. Cannot be undone.</div>
              </button>
              
              <button onClick={() => { setShowDeleteModal(false); setDeletingList(null); }} className="w-full py-3 mt-2 text-xs font-mono uppercase tracking-widest text-[var(--muted)] hover:text-white transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
