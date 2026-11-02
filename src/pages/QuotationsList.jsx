import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { notify } from '../lib/notify';
import { Search, Edit, RefreshCw, Send, Check, Copy, Trash, Download, X, XCircle } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import DocumentPDFTemplate from '../components/Finance/DocumentPDFTemplate';
import { useRef } from 'react';
import useMediaQuery from '../utils/useMediaQuery';

export default function QuotationsList() {
  const isAdmin = JSON.parse(localStorage.getItem('crm_user') || '{}').role === 'admin';
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingQuotation, setEditingQuotation] = useState(null);
  const [downloadingQuote, setDownloadingQuote] = useState(null);
  const [deletingQuotationId, setDeletingQuotationId] = useState(null);
  const pdfRef = useRef(null);

  const fetchQuotations = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('quotations')
        .select(`
          *,
          leads ( name, email, phone )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const enriched = data.map(q => ({
        ...q,
        lead_name: q.leads?.name || 'Unknown Lead',
        lead_email: q.leads?.email || '',
        lead_phone: q.leads?.phone || ''
      }));
      setQuotations(enriched);
    } catch (err) {
      console.error('Error fetching quotations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuotations();
  }, []);

  const handleStatusChange = async (id, newStatus) => {
    try {
      const { error } = await supabase.from('quotations').update({ status: newStatus }).eq('id', id);
      if (error) throw error;
      fetchQuotations();
    } catch (err) {
      notify('Failed to update status: ' + err.message, 'error');
    }
  };

  const handleConvertToInvoice = async (quotation) => {
    try {
      const issueDate = new Date().toISOString().split('T')[0];
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 14); // 14 days by default
      
      const { error } = await supabase.from('invoices').insert([{
        quotation_id: quotation.id,
        lead_id: quotation.lead_id,
        amount: quotation.price,
        discount: quotation.discount || 0,
        issue_date: issueDate,
        due_date: dueDate.toISOString().split('T')[0],
        notes: `Auto-converted from Quotation #${quotation.id} (${quotation.service})`,
        status: 'Unpaid'
      }]);
      
      if (error) throw error;
      
      // Update quotation status to Invoiced
      const { error: statusError } = await supabase.from('quotations').update({ status: 'Invoiced' }).eq('id', quotation.id);
      if (statusError) throw statusError;

window.location.href = '/finance/invoices';
    } catch (err) {
      console.error(err);
      notify('Error creating invoice: ' + err.message, 'error');
    }
  };

  const handleDuplicate = async (quotation) => {
    try {
      const { id, created_at, ...copyData } = quotation;
      delete copyData.leads;
      delete copyData.lead_name;
      delete copyData.lead_email;
      delete copyData.lead_phone;
      
      const { error } = await supabase.from('quotations').insert([{
        ...copyData,
        status: 'Draft'
      }]);
      
      if (error) throw error;
      fetchQuotations();
    } catch (err) {
      notify('Failed to duplicate quotation: ' + err.message, 'error');
    }
  };

  const confirmDelete = async () => {
    if (!deletingQuotationId) return;
    try {
      const { error } = await supabase.from('quotations').delete().eq('id', deletingQuotationId);
      if (error) throw error;
      fetchQuotations();
      setDeletingQuotationId(null);
    } catch (err) {
      notify('Failed to delete quotation: ' + err.message, 'error');
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      const { id, leads, lead_name, lead_email, lead_phone, created_at, ...updateData } = editingQuotation;
      const { error } = await supabase.from('quotations').update(updateData).eq('id', id);
      if (error) throw error;
      setEditingQuotation(null);
      fetchQuotations();
    } catch (err) {
      notify('Failed to update quotation: ' + err.message, 'error');
    }
  };

  const downloadPDF = (q) => {
    setDownloadingQuote(q);
    setTimeout(() => {
      const element = pdfRef.current;
      if (!element) return;
      html2pdf().set({
        margin:       0,
        filename:     `Quotation_${q.id}_${q.lead_name}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true },
        jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
      }).from(element).save().then(() => setDownloadingQuote(null));
    }, 100);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
  };

  const renderStatusBadge = (status) => {
    const statusConfig = {
      'Draft': 'bg-[rgba(255,255,255,0.04)] text-[var(--muted-light)] border-[rgba(200,180,138,0.08)]',
      'Sent': 'bg-[rgba(247,185,85,0.1)] text-[var(--warning)] border-[rgba(247,185,85,0.2)]',
      'Accepted': 'bg-[rgba(0,196,140,0.1)] text-[var(--success)] border-[rgba(0,196,140,0.2)]',
      'Rejected': 'bg-[rgba(255,90,90,0.1)] text-[var(--danger)] border-[rgba(255,90,90,0.2)]'
    };
    const cssClass = statusConfig[status] || statusConfig['Draft'];
    return (
      <span className={`px-3 py-1 rounded-lg text-[10px] font-mono uppercase tracking-widest border ${cssClass}`}>
        {status}
      </span>
    );
  };

  const filteredQuotations = quotations.filter(p => 
    p.lead_name?.toLowerCase().includes(search.toLowerCase()) || 
    p.service.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      <div className="glass-card p-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl heading-serif text-[var(--text)]">Quotations</h1>
          <p className="text-[11px] font-mono uppercase tracking-widest text-[var(--muted-light)] mt-2">Manage service quotations</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
            <input 
              type="text" 
              placeholder="Search quotations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl text-sm text-[var(--text)] focus:outline-none placeholder-[var(--muted)]"
              style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(200, 180, 138, 0.08)' }}
            />
          </div>
          <button 
            onClick={fetchQuotations}
            className="p-2.5 rounded-xl transition-all hover:text-[var(--accent)] text-[var(--muted-light)]"
            style={{ border: '1px solid rgba(200, 180, 138, 0.08)' }}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-32">
          <div className="animate-pulse text-[var(--accent)] font-serif text-xl">Loading quotations...</div>
        </div>
      ) : filteredQuotations.length === 0 ? (
        <div className="text-center py-24 glass-card">
          <p className="text-[var(--muted)] font-mono text-sm uppercase tracking-widest mb-2">No Quotations Found</p>
          <p className="text-[var(--muted-light)] text-sm">Generate one from a Lead's drawer.</p>
        </div>
      ) : isMobile ? (
        <div className="flex flex-col gap-4">
          {filteredQuotations.map(quotation => (
            <div key={quotation.id} className="glass-card-subtle p-5 relative overflow-hidden" style={{ borderRadius: '16px' }}>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-serif text-xl text-[var(--text)] leading-tight mb-1">{quotation.lead_name}</h3>
                  <p className="text-xs font-mono text-[var(--muted)]">{new Date(quotation.created_at).toLocaleDateString()}</p>
                </div>
                <div>{renderStatusBadge(quotation.status)}</div>
              </div>

              <div className="flex justify-between items-center py-3 border-y border-[rgba(200,180,138,0.06)] mb-4 mt-2">
                <div>
                  <p className="text-[9px] font-mono uppercase text-[var(--muted-light)] mb-1 tracking-widest">Service</p>
                  <p className="text-sm text-[var(--text)]">{quotation.service}</p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-mono uppercase text-[var(--muted-light)] mb-1 tracking-widest">Price</p>
                  <p className="font-serif text-lg text-[var(--accent)]">{formatCurrency(quotation.price)}</p>
                </div>
              </div>

              {/* Status Actions */}
              <div className="flex gap-2 mb-3">
                {quotation.status === 'Draft' && (
                  <button onClick={() => handleStatusChange(quotation.id, 'Sent')} className="flex-1 btn-secondary py-2 text-[10px] font-mono flex items-center justify-center gap-2 hover:text-[var(--warning)] hover:border-[var(--warning)]">
                    <Send className="w-3.5 h-3.5" /> Mark Sent
                  </button>
                )}
                {quotation.status === 'Sent' && (
                  <>
                    <button onClick={() => handleStatusChange(quotation.id, 'Accepted')} className="flex-1 btn-secondary py-2 text-[10px] font-mono flex items-center justify-center gap-2 hover:text-[var(--success)] hover:border-[var(--success)]">
                      <Check className="w-3.5 h-3.5" /> Accept
                    </button>
                    <button onClick={() => handleStatusChange(quotation.id, 'Rejected')} className="flex-1 btn-secondary py-2 text-[10px] font-mono flex items-center justify-center gap-2 hover:text-[var(--danger)] hover:border-[var(--danger)]">
                      <XCircle className="w-3.5 h-3.5" /> Reject
                    </button>
                  </>
                )}
                {isAdmin && quotation.status === 'Accepted' && (
                  <button onClick={() => handleConvertToInvoice(quotation)} className="flex-1 btn-primary py-2 text-[10px] font-mono flex items-center justify-center gap-2">
                    Convert Invoice
                  </button>
                )}
              </div>

              {/* Management Actions */}
              <div className="grid grid-cols-4 gap-2">
                <button onClick={() => downloadPDF(quotation)} className="py-2 flex justify-center items-center rounded-xl bg-[rgba(255,255,255,0.03)] border border-[rgba(200,180,138,0.08)] text-[var(--muted)] hover:text-white hover:bg-[rgba(255,255,255,0.05)] active:scale-95 transition-all">
                  <Download className="w-4 h-4" />
                </button>
                <button onClick={() => handleDuplicate(quotation)} className="py-2 flex justify-center items-center rounded-xl bg-[rgba(255,255,255,0.03)] border border-[rgba(200,180,138,0.08)] text-[var(--muted)] hover:text-white hover:bg-[rgba(255,255,255,0.05)] active:scale-95 transition-all">
                  <Copy className="w-4 h-4" />
                </button>
                <button onClick={() => setEditingQuotation(quotation)} className="py-2 flex justify-center items-center rounded-xl bg-[rgba(255,255,255,0.03)] border border-[rgba(200,180,138,0.08)] text-[var(--muted)] hover:text-white hover:bg-[rgba(255,255,255,0.05)] active:scale-95 transition-all">
                  <Edit className="w-4 h-4" />
                </button>
                <button onClick={() => setDeletingQuotationId(quotation.id)} className="py-2 flex justify-center items-center rounded-xl bg-[rgba(255,90,90,0.05)] border border-[rgba(255,90,90,0.1)] text-[var(--danger)] hover:bg-[rgba(255,90,90,0.1)] active:scale-95 transition-all">
                  <Trash className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="glass-card overflow-hidden" style={{ borderRadius: '16px' }}>
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead style={{ background: 'rgba(5, 5, 5, 0.6)', borderBottom: '1px solid rgba(200, 180, 138, 0.06)' }}>
                <tr>
                  <th className="px-6 py-4 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Client / Lead</th>
                  <th className="px-6 py-4 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Service</th>
                  <th className="px-6 py-4 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Price</th>
                  <th className="px-6 py-4 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Status</th>
                  <th className="px-6 py-4 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(200,180,138,0.04)]">
                {filteredQuotations.map(quotation => (
                  <tr key={quotation.id} className="hover:bg-[rgba(255,255,255,0.02)] transition-colors group">
                    <td className="px-6 py-4">
                      <p className="font-serif text-lg text-[var(--text)]">{quotation.lead_name}</p>
                      <p className="text-xs font-mono text-[var(--muted)] mt-1">{new Date(quotation.created_at).toLocaleDateString()}</p>
                    </td>
                    <td className="px-6 py-4 text-[var(--muted-light)]">{quotation.service}</td>
                    <td className="px-6 py-4 font-serif text-[var(--accent)]">{formatCurrency(quotation.price)}</td>
                    <td className="px-6 py-4">{renderStatusBadge(quotation.status)}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex flex-col items-end gap-2">
                        {/* Status Actions */}
                        <div className="flex items-center justify-end gap-2">
                          {quotation.status === 'Draft' && (
                            <button onClick={() => handleStatusChange(quotation.id, 'Sent')} className="btn-secondary px-3 py-1.5 text-[10px] font-mono flex items-center gap-1 hover:text-[var(--warning)] hover:border-[var(--warning)]">
                              <Send className="w-3 h-3" /> Mark Sent
                            </button>
                          )}
                          {quotation.status === 'Sent' && (
                            <>
                              <button onClick={() => handleStatusChange(quotation.id, 'Accepted')} className="btn-secondary px-3 py-1.5 text-[10px] font-mono flex items-center gap-1 hover:text-[var(--success)] hover:border-[var(--success)]">
                                <Check className="w-3 h-3" /> Accept
                              </button>
                              <button onClick={() => handleStatusChange(quotation.id, 'Rejected')} className="btn-secondary px-3 py-1.5 text-[10px] font-mono flex items-center gap-1 hover:text-[var(--danger)] hover:border-[var(--danger)]">
                                <XCircle className="w-3 h-3" /> Reject
                              </button>
                            </>
                          )}
                          {isAdmin && quotation.status === 'Accepted' && (
                            <button onClick={() => handleConvertToInvoice(quotation)} className="btn-primary px-3 py-1.5 text-[10px] font-mono flex items-center gap-1">
                              Convert Invoice
                            </button>
                          )}
                        </div>

                        {/* Management Actions */}
                        <div className="flex items-center justify-end gap-1 mt-1 opacity-50 hover:opacity-100 transition-opacity">
                          <button onClick={() => downloadPDF(quotation)} title="Download PDF" className="p-1.5 rounded hover:bg-[rgba(255,255,255,0.05)] text-[var(--muted-light)] hover:text-white transition-colors">
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDuplicate(quotation)} title="Duplicate" className="p-1.5 rounded hover:bg-[rgba(255,255,255,0.05)] text-[var(--muted-light)] hover:text-white transition-colors">
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setEditingQuotation(quotation)} title="Edit" className="p-1.5 rounded hover:bg-[rgba(255,255,255,0.05)] text-[var(--muted-light)] hover:text-white transition-colors">
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setDeletingQuotationId(quotation.id)} title="Delete" className="p-1.5 rounded hover:bg-[rgba(255,90,90,0.1)] text-[var(--muted-light)] hover:text-[var(--danger)] transition-colors">
                            <Trash className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Quotation Modal */}
      {editingQuotation && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="glass-card p-6 w-full max-w-md animate-in zoom-in-95" style={{ border: '1px solid rgba(200,180,138,0.15)' }}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-serif text-2xl text-[var(--text)]">Edit Quotation</h3>
              <button onClick={() => setEditingQuotation(null)} className="text-[var(--muted)] hover:text-white"><X className="w-5 h-5"/></button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] mb-1">Service Name</label>
                <input required type="text" value={editingQuotation.service} onChange={e => setEditingQuotation({...editingQuotation, service: e.target.value})} className="w-full bg-[rgba(255,255,255,0.03)] border border-[rgba(200,180,138,0.08)] rounded-xl px-4 py-2 text-sm text-[var(--text)] focus:outline-none" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] mb-1">Price (₹)</label>
                  <input type="number" required value={editingQuotation.price} onChange={e => setEditingQuotation({...editingQuotation, price: e.target.value})} className="w-full bg-[rgba(12,12,12,0.5)] border border-[rgba(255,255,255,0.05)] rounded-xl p-3 text-sm focus:border-[var(--accent)] outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] mb-1">Discount (₹)</label>
                  <input type="number" value={editingQuotation.discount || ''} onChange={e => setEditingQuotation({...editingQuotation, discount: e.target.value})} className="w-full bg-[rgba(12,12,12,0.5)] border border-[rgba(255,255,255,0.05)] rounded-xl p-3 text-sm focus:border-[var(--accent)] outline-none" placeholder="0" />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] mb-1">Timeline</label>
                <input required type="text" value={editingQuotation.timeline} onChange={e => setEditingQuotation({...editingQuotation, timeline: e.target.value})} className="w-full bg-[rgba(255,255,255,0.03)] border border-[rgba(200,180,138,0.08)] rounded-xl px-4 py-2 text-sm text-[var(--text)] focus:outline-none" />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] mb-1">Deliverables</label>
                <textarea required rows="3" value={editingQuotation.deliverables} onChange={e => setEditingQuotation({...editingQuotation, deliverables: e.target.value})} className="w-full bg-[rgba(255,255,255,0.03)] border border-[rgba(200,180,138,0.08)] rounded-xl px-4 py-2 text-sm text-[var(--text)] focus:outline-none custom-scrollbar" />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] mb-1">Terms</label>
                <textarea required rows="2" value={editingQuotation.terms} onChange={e => setEditingQuotation({...editingQuotation, terms: e.target.value})} className="w-full bg-[rgba(255,255,255,0.03)] border border-[rgba(200,180,138,0.08)] rounded-xl px-4 py-2 text-sm text-[var(--text)] focus:outline-none custom-scrollbar"/>
              </div>

              <button type="submit" className="btn-primary w-full py-3 mt-4">
                Save Changes
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingQuotationId && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="glass-card p-6 w-full max-w-sm animate-in zoom-in-95" style={{ border: '1px solid rgba(255,90,90,0.2)' }}>
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-[rgba(255,90,90,0.1)] flex items-center justify-center mb-4">
                <Trash className="w-6 h-6 text-[var(--danger)]" />
              </div>
              <h3 className="font-serif text-xl text-[var(--text)] mb-2">Delete Quotation?</h3>
              <p className="text-sm text-[var(--muted-light)] mb-6">This action cannot be undone. This will permanently remove the quotation from the system.</p>
              <div className="flex gap-3 w-full">
                <button onClick={() => setDeletingQuotationId(null)} className="btn-secondary flex-1 py-2 text-xs">
                  Cancel
                </button>
                <button onClick={confirmDelete} className="btn-primary flex-1 py-2 text-xs !bg-[var(--danger)] !border-[var(--danger)] !text-white hover:opacity-90">
                  Yes, Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hidden PDF renderer */}
      {downloadingQuote && (
        <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
          <DocumentPDFTemplate ref={pdfRef} type="quotation" data={downloadingQuote} />
        </div>
      )}
    </div>
  );
}
