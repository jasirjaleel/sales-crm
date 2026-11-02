import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabase';
import { X, UserPlus, Users, CheckCircle } from 'lucide-react';
import { normalizePhone } from '../../utils/phone';

export default function CreateLeadModal({ onClose, onSuccess }) {
  const [activeTab, setActiveTab] = useState('single'); // 'single' or 'bulk'
  
  const [lists, setLists] = useState([]);
  const [users, setUsers] = useState([]);
  const [loadingConfig, setLoadingConfig] = useState(true);
  
  const currentUser = JSON.parse(localStorage.getItem('crm_user') || '{}');
  const isAdmin = currentUser.role === 'admin';

  // Form State - Single
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [location, setLocation] = useState('');
  const [category, setCategory] = useState('Other');
  const [listId, setListId] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [notes, setNotes] = useState('');

  // Form State - Bulk
  const [bulkData, setBulkData] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMode, setSuccessMode] = useState(false);
  const [createdCount, setCreatedCount] = useState(0);
  const [error, setError] = useState('');

  const fetchConfig = async () => {
    try {
      setLoadingConfig(true);
      
      const { data: listsData } = await supabase.from('lead_lists').select('*');
      if (listsData) setLists(listsData);
      
      if (isAdmin) {
        const { data: usersData } = await supabase.from('profiles').select('*');
        if (usersData) setUsers(usersData);
      }
    } catch (err) {
      console.error('Error fetching config for modal', err);
    } finally {
      setLoadingConfig(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once when the page opens
  }, []);

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    setError('');

    let leadsToCreate = [];

    if (activeTab === 'single') {
      if (!name || !phone) {
        return setError('Business Name and Phone Number are required.');
      }
      leadsToCreate.push({
        name,
        phone: normalizePhone(phone) || phone.trim(),
        website,
        location,
        category,
        list_id: listId || null,
        assigned_to: isAdmin ? (assignedTo || null) : currentUser.id,
        notes
      });
    } else {
      if (!bulkData.trim()) {
        return setError('Please enter at least one lead.');
      }
      const lines = bulkData.split('\n').filter(l => l.trim() !== '');
      for (const line of lines) {
        // Assume format "Name,Phone"
        const parts = line.split(',');
        if (parts.length >= 2) {
          leadsToCreate.push({
            name: parts[0].trim(),
            phone: normalizePhone(parts[1]) || parts[1].trim(),
            list_id: listId || null,
            assigned_to: isAdmin ? (assignedTo || null) : currentUser.id,
          });
        }
      }
      if (leadsToCreate.length === 0) {
        return setError('No valid leads found. Use format "Business Name,Phone"');
      }
    }

    try {
      setIsSubmitting(true);
      
      const { error: insertError } = await supabase.from('leads').insert(leadsToCreate);
      if (insertError) throw insertError;

      setCreatedCount(leadsToCreate.length);
      setSuccessMode(true);
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error(err);
      setError('Error creating lead(s). Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setName('');
    setPhone('');
    setWebsite('');
    setLocation('');
    setNotes('');
    setBulkData('');
    setSuccessMode(false);
    setError('');
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-black/60" onClick={onClose}></div>
      
      <div className="relative card-primitive w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl" 
           style={{ border: '1px solid var(--border-strong)' }}>
        
        {/* Header */}
        <div className="p-6 border-b border-[rgba(200,180,138,0.1)] flex justify-between items-center bg-[rgba(5,5,5,0.6)]">
          <div>
            <h2 className="text-2xl font-medium tracking-tight text-[var(--text)] leading-none">Create Lead</h2>
            <p className="text-[var(--muted-light)] font-mono text-[10px] uppercase tracking-widest mt-2">Add a new prospect to your CRM.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-[var(--bg-surface-highlight)] rounded-full transition-colors text-[var(--muted)] hover:text-[var(--text)]">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar relative">
          {successMode ? (
            <div className="text-center py-16 animate-in zoom-in duration-300">
              <CheckCircle className="w-16 h-16 text-[var(--success-emerald)] mx-auto mb-6" />
              <h3 className="text-3xl font-medium tracking-tight text-[var(--text)] mb-2">Lead{createdCount > 1 ? 's' : ''} Created Successfully</h3>
              <p className="text-[var(--muted)] font-mono text-sm mb-10">{createdCount} lead{createdCount > 1 ? 's' : ''} added to the CRM.</p>
              
              <div className="flex justify-center gap-4">
                <button 
                  onClick={onClose}
                  className="btn-secondary px-6 py-2.5 font-mono text-xs uppercase tracking-widest"
                >
                  Close
                </button>
                <button 
                  onClick={resetForm}
                  className="btn-primary px-6 py-2.5 font-mono text-xs uppercase tracking-widest"
                >
                  Add Another Lead
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Tabs */}
              <div className="flex gap-2 p-1 bg-[rgba(255,255,255,0.02)] rounded-lg border border-[var(--border-subtle)]">
                <button 
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-mono uppercase tracking-widest rounded-md transition-all ${activeTab === 'single' ? 'bg-[rgba(200,180,138,0.1)] text-[var(--accent-blue)]' : 'text-[var(--muted)] hover:text-[var(--text)]'}`}
                  onClick={() => setActiveTab('single')}
                >
                  <UserPlus className="w-3.5 h-3.5" /> Single Lead
                </button>
                <button 
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-mono uppercase tracking-widest rounded-md transition-all ${activeTab === 'bulk' ? 'bg-[rgba(200,180,138,0.1)] text-[var(--accent-blue)]' : 'text-[var(--muted)] hover:text-[var(--text)]'}`}
                  onClick={() => setActiveTab('bulk')}
                >
                  <Users className="w-3.5 h-3.5" /> Bulk Add
                </button>
              </div>

              {error && (
                <div className="p-3 bg-[rgba(255,90,90,0.1)] border border-[rgba(255,90,90,0.2)] rounded-lg text-[var(--danger)] text-xs font-mono">
                  {error}
                </div>
              )}

              {activeTab === 'single' ? (
                <div className="grid grid-cols-2 gap-5">
                  <div className="col-span-2 md:col-span-1">
                    <label className="block text-[10px] font-mono uppercase text-[var(--muted)] tracking-widest mb-2">Business Name *</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. ABC Dental Clinic" autoFocus
                      className="w-full bg-[rgba(255,255,255,0.02)] border border-[rgba(200,180,138,0.1)] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--accent)] text-[var(--text)]" />
                  </div>
                  <div className="col-span-2 md:col-span-1">
                    <label className="block text-[10px] font-mono uppercase text-[var(--muted)] tracking-widest mb-2">Phone Number *</label>
                    <input type="text" value={phone} onChange={e => setPhone(e.target.value)} placeholder="e.g. +91 80893 61377" 
                      className="w-full bg-[rgba(255,255,255,0.02)] border border-[rgba(200,180,138,0.1)] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--accent)] text-[var(--text)]" />
                  </div>
                  <div className="col-span-2 md:col-span-1">
                    <label className="block text-[10px] font-mono uppercase text-[var(--muted)] tracking-widest mb-2">Website</label>
                    <input type="text" value={website} onChange={e => setWebsite(e.target.value)} placeholder="e.g. https://abcdental.com" 
                      className="w-full bg-[rgba(255,255,255,0.02)] border border-[rgba(200,180,138,0.1)] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--accent)] text-[var(--text)]" />
                  </div>
                  <div className="col-span-2 md:col-span-1">
                    <label className="block text-[10px] font-mono uppercase text-[var(--muted)] tracking-widest mb-2">Location</label>
                    <input type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Thrissur" 
                      className="w-full bg-[rgba(255,255,255,0.02)] border border-[rgba(200,180,138,0.1)] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--accent)] text-[var(--text)]" />
                  </div>
                  <div className="col-span-2 md:col-span-1">
                    <label className="block text-[10px] font-mono uppercase text-[var(--muted)] tracking-widest mb-2">Category</label>
                    <select value={category} onChange={e => setCategory(e.target.value)}
                      className="w-full bg-[rgba(255,255,255,0.02)] border border-[rgba(200,180,138,0.1)] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--accent)] text-[var(--text)]">
                      <option value="Dental">Dental</option>
                      <option value="Cleaning">Cleaning</option>
                      <option value="HVAC">HVAC</option>
                      <option value="Plumber">Plumber</option>
                      <option value="Real Estate">Real Estate</option>
                      <option value="Restaurant">Restaurant</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="col-span-2 md:col-span-1">
                    <label className="block text-[10px] font-mono uppercase text-[var(--muted)] tracking-widest mb-2">Lead List</label>
                    <select value={listId} onChange={e => setListId(e.target.value)}
                      className="w-full bg-[rgba(255,255,255,0.02)] border border-[rgba(200,180,138,0.1)] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--accent)] text-[var(--text)]">
                      <option value="">Uncategorized</option>
                      {lists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  </div>
                  
                  {isAdmin && (
                    <div className="col-span-2">
                      <label className="block text-[10px] font-mono uppercase text-[var(--muted)] tracking-widest mb-2">Assign To</label>
                      <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)}
                        className="w-full bg-[rgba(255,255,255,0.02)] border border-[rgba(200,180,138,0.1)] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--accent)] text-[var(--text)]">
                        <option value="">Unassigned</option>
                        {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </select>
                    </div>
                  )}

                  <div className="col-span-2">
                    <label className="block text-[10px] font-mono uppercase text-[var(--muted)] tracking-widest mb-2">Notes</label>
                    <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Referral from Ahmed..." rows={2}
                      className="w-full bg-[rgba(255,255,255,0.02)] border border-[rgba(200,180,138,0.1)] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--accent)] text-[var(--text)] custom-scrollbar resize-none"></textarea>
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-5">
                    <div className="col-span-2 md:col-span-1">
                      <label className="block text-[10px] font-mono uppercase text-[var(--muted)] tracking-widest mb-2">Lead List</label>
                      <select value={listId} onChange={e => setListId(e.target.value)}
                        className="w-full bg-[rgba(255,255,255,0.02)] border border-[rgba(200,180,138,0.1)] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--accent)] text-[var(--text)]">
                        <option value="">Uncategorized</option>
                        {lists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                      </select>
                    </div>
                    {isAdmin && (
                      <div className="col-span-2 md:col-span-1">
                        <label className="block text-[10px] font-mono uppercase text-[var(--muted)] tracking-widest mb-2">Assign To</label>
                        <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)}
                          className="w-full bg-[rgba(255,255,255,0.02)] border border-[rgba(200,180,138,0.1)] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--accent)] text-[var(--text)]">
                          <option value="">Unassigned</option>
                          {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-[var(--muted)] tracking-widest mb-2">Paste Leads (One per line)</label>
                    <textarea value={bulkData} onChange={e => setBulkData(e.target.value)} placeholder="ABC Dental,8089361377&#10;Smile Clinic,9895123456" rows={8} autoFocus
                      className="w-full bg-[rgba(255,255,255,0.02)] border border-[rgba(200,180,138,0.1)] rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[var(--accent)] text-[var(--text)] custom-scrollbar resize-none font-mono"></textarea>
                    <p className="text-[10px] text-[var(--muted)] mt-2 font-mono">Format: Business Name,Phone Number</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {!successMode && (
          <div className="p-6 border-t border-[rgba(200,180,138,0.1)] bg-[rgba(5,5,5,0.6)] flex justify-end gap-3">
            <button 
              onClick={onClose}
              className="btn-secondary px-6 py-2.5 font-mono text-xs uppercase tracking-widest"
            >
              Cancel
            </button>
            <button 
              onClick={handleSave}
              disabled={isSubmitting || loadingConfig}
              className="btn-primary px-8 py-2.5 font-mono text-xs uppercase tracking-widest disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Save Lead'}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
