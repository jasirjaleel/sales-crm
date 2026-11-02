import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { notify, notifyError } from '../lib/notify';
import { MessageCircle, Plus, CheckCircle, Save, X } from 'lucide-react';

export default function WhatsAppTemplates() {
  const [templates, setTemplates] = useState([]);
  const [activeTemplateBody, setActiveTemplateBody] = useState('');
  
  // Form State
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: '', message: '' });

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_templates')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setTemplates(data || []);
      
      const active = (data || []).find(t => t.is_active);
      if (active) {
        setActiveTemplateBody(active.message);
        localStorage.setItem('crm_active_wa_template', active.message);
      }
} catch (err) {
      notifyError(err, 'Could not load templates.');
}
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleActivate = async (templateBody) => {
    const template = templates.find(t => t.message === templateBody);
    if (!template) return;
    try {
      const { error: clearError } = await supabase.from('whatsapp_templates').update({ is_active: false }).eq('is_active', true);
      if (clearError) throw clearError;
      const { error } = await supabase.from('whatsapp_templates').update({ is_active: true }).eq('id', template.id);
      if (error) throw error;
      setActiveTemplateBody(templateBody);
      localStorage.setItem('crm_active_wa_template', templateBody);
      notify('Active template updated for the team.');
      fetchTemplates();
    } catch (err) {
      notifyError(err, 'Could not change the active template.');
    }
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.message.trim()) return;
    
    try {
      if (editingId) {
        const { error } = await supabase
          .from('whatsapp_templates')
          .update({ name: form.name, message: form.message })
          .eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('whatsapp_templates')
          .insert([{ name: form.name, message: form.message }]);
        if (error) throw error;
      }
      
      setForm({ name: '', message: '' });
      setEditingId(null);
      setShowForm(false);
      fetchTemplates();
    } catch (err) {
      notifyError(err, 'Could not save this template.');
}
  };

  const handleEdit = (tpl) => {
    setForm({ name: tpl.name, message: tpl.message });
    setEditingId(tpl.id);
    setShowForm(true);
  };

  const handleDelete = async (id, message) => {
    if (!window.confirm('Delete this template?')) return;
    try {
      const { error } = await supabase
        .from('whatsapp_templates')
        .delete()
        .eq('id', id);
      if (error) throw error;
      
      // If we delete the active template, clear it
      if (activeTemplateBody === message) {
        localStorage.removeItem('crm_active_wa_template');
        setActiveTemplateBody('');
      }
      
      fetchTemplates();
    } catch (err) {
      notifyError(err, 'Could not delete this template.');
}
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12 max-w-5xl">
      <div className="flex justify-between items-end border-b border-[var(--border-subtle)] pb-6">
        <div>
          <h1 className="text-4xl heading-serif text-[var(--text)]">WhatsApp Templates.</h1>
          <p className="text-[var(--text-tertiary)] mt-2 text-xs uppercase tracking-widest font-medium">Manage your outreach messages</p>
        </div>
        <button 
          onClick={() => {
            setForm({ name: '', message: '' });
            setEditingId(null);
            setShowForm(!showForm);
          }}
          className="btn-primary px-5 py-2.5 text-xs uppercase tracking-widest flex items-center gap-2"
        >
          {showForm ? <><X className="w-4 h-4" /> Cancel</> : <><Plus className="w-4 h-4" /> New Template</>}
        </button>
      </div>

      {showForm && (
        <div className="card-primitive p-8 mb-8 transition-all animate-in slide-in-from-top-4">
          <h2 className="heading-serif text-2xl text-[var(--text-primary)] mb-6">
            {editingId ? 'Edit Template' : 'Create New Template'}
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] text-[var(--text-tertiary)] uppercase tracking-widest font-medium mb-2">Template Name</label>
              <input
                placeholder="e.g. Interior Design Intro"
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-lg text-sm text-[var(--text-primary)] bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] focus:outline-none focus:border-[var(--border-strong)] placeholder-[var(--text-tertiary)]"
              />
            </div>
            <div>
              <label className="block text-[10px] text-[var(--text-tertiary)] uppercase tracking-widest font-medium mb-2 flex justify-between">
                <span>Message Body</span>
                <span>Use {'{businessName}'} as placeholder</span>
              </label>
              <textarea
                placeholder="Message... use {businessName} as placeholder"
                value={form.message}
                onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
                rows={5}
                className="w-full px-4 py-2.5 rounded-lg text-sm text-[var(--text-primary)] bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] focus:outline-none focus:border-[var(--border-strong)] placeholder-[var(--text-tertiary)] resize-none custom-scrollbar"
              />
            </div>
            <div className="pt-4 flex justify-end">
              <button onClick={handleSave} className="btn-primary flex items-center gap-2 px-8 py-2.5">
                <Save className="w-4 h-4" /> {editingId ? 'Update Template' : 'Save Template'}
              </button>
            </div>
          </div>
        </div>
      )}

      {templates.length === 0 && !showForm && (
        <div className="text-center py-20 card-primitive">
          <MessageCircle className="w-8 h-8 text-[var(--text-tertiary)] mx-auto mb-3" />
          <p className="text-[var(--text-secondary)]">No templates yet</p>
          <p className="text-xs text-[var(--text-tertiary)] mt-1">Create your first WhatsApp outreach template</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {templates.map((tpl) => {
          const isActive = activeTemplateBody === tpl.message;

          return (
            <div 
              key={tpl.id} 
              className={`card-primitive p-8 transition-all duration-300 ${isActive ? '!border-[var(--success-emerald)]' : ''}`}
            >
              <div className="flex justify-between items-start mb-6">
                <h3 className={`heading-serif text-2xl ${isActive ? 'text-[var(--success-emerald)]' : 'text-[var(--text-primary)]'}`}>
                  {tpl.name}
                </h3>
                {isActive ? (
                  <span className="pill-tag bg-[var(--success-dim)] text-[var(--success-emerald)] border-[rgba(16,185,129,0.2)]">
                    <CheckCircle className="w-3 h-3 mr-1" /> Active
                  </span>
                ) : (
                  <button 
                    onClick={() => handleActivate(tpl.message)}
                    className="pill-tag hover:bg-[var(--bg-surface-highlight)] transition-colors cursor-pointer"
                  >
                    Activate
                  </button>
                )}
              </div>
              
              <div className="bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] p-5 rounded-lg text-[var(--text-secondary)] text-sm whitespace-pre-wrap leading-relaxed">
                {tpl.message}
              </div>
              
              <div className="mt-6 flex gap-3">
                <button 
                  onClick={() => handleEdit(tpl)}
                  className="btn-secondary px-4 py-2 text-xs uppercase tracking-widest"
                >
                  Edit
                </button>
                <button 
                  onClick={() => handleDelete(tpl.id, tpl.message)}
                  className="px-4 py-2 rounded-lg text-xs uppercase tracking-widest text-[var(--danger)] transition-all hover:bg-[var(--danger-dim)] border border-transparent hover:border-[rgba(239,68,68,0.2)]"
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
