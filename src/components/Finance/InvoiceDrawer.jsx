import { useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { notify, notifyError } from '../../lib/notify';
import { X, Download, IndianRupee, Ban, Edit, MessageCircle } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import DocumentPDFTemplate from './DocumentPDFTemplate';
import { buildWhatsAppLink } from '../../utils/whatsapp';

export default function InvoiceDrawer({ invoice, onClose }) {
  const [internalNotes, setInternalNotes] = useState(invoice.notes || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editData, setEditData] = useState({ amount: invoice.amount, due_date: invoice.due_date ? invoice.due_date.split('T')[0] : '' });
  const pdfRef = useRef(null);

  if (!invoice) return null;

  const updateInvoice = async (changes) => {
    const { error } = await supabase.from('invoices').update(changes).eq('id', invoice.id);
    if (error) throw error;
  };

  const confirmDelete = async () => {
    try {
      const { error } = await supabase.from('invoices').delete().eq('id', invoice.id);
      if (error) throw error;
      onClose();
    } catch (err) {
      notifyError(err, 'Failed to delete invoice.');
    }
  };

  const handleStatusChange = async (newStatus) => {
    try {
      await updateInvoice({ status: newStatus });
      notify(`Invoice marked ${newStatus}.`);
      onClose(); // Will trigger refresh in parent
    } catch (err) {
      notifyError(err, 'Failed to update status.');
    }
  };

  const handleSaveNotes = async () => {
    if (internalNotes === (invoice.notes || '')) return;
    try {
      setIsSaving(true);
      await updateInvoice({ notes: internalNotes });
    } catch (err) {
      notifyError(err, 'Failed to save notes.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    try {
      setIsSaving(true);
      await updateInvoice({ amount: editData.amount, due_date: editData.due_date || null });
      setIsEditing(false);
      onClose(); // refresh
    } catch (err) {
      notifyError(err, 'Failed to update invoice.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadPDF = () => {
    const element = pdfRef.current;
    if (!element) return;

    // We temporarily unhide it for html2pdf, though absolute positioning offscreen also works
    const opt = {
      margin:       0,
      filename:     `${invoice.invoice_number}_${invoice.lead_name}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save();
  };

  const netAmount = Number(invoice.amount) - Number(invoice.discount || 0);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
  };

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-[rgba(0,0,0,0.4)] animate-in fade-in duration-300" onClick={onClose} />
      
      <div className="fixed top-0 right-0 h-full w-full md:w-[450px] z-[70] flex flex-col animate-in slide-in-from-right duration-300"
        style={{
          background: 'rgba(8, 8, 8, 0.95)',
          borderLeft: '1px solid rgba(200, 180, 138, 0.15)',
          boxShadow: '-20px 0 60px rgba(0,0,0,0.6)',
        }}
      >
        <div className="flex items-center justify-between p-6 border-b border-[rgba(200,180,138,0.06)]">
          <div>
            <h2 className="font-serif text-2xl text-[var(--text)] flex items-center gap-3">
              {invoice.invoice_number}
              {!isEditing && invoice.status !== 'Paid' && (
                <button onClick={() => setIsEditing(true)} className="text-[var(--muted-light)] hover:text-white transition-colors">
                  <Edit className="w-4 h-4" />
                </button>
              )}
            </h2>
            <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted-light)] mt-1">{invoice.status}</p>
          </div>
          <button onClick={onClose} className="p-2 text-[var(--muted)] hover:text-[var(--text)] transition-colors rounded-xl hover:bg-[rgba(255,255,255,0.05)]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
          
          <div className="space-y-4">
            <div className="glass-card p-5" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] mb-1">Client</p>
              <p className="font-serif text-lg text-[var(--text)]">{invoice.lead_name}</p>
              <p className="text-xs font-mono text-[var(--muted-light)] mt-1">{invoice.lead_email || 'No Email'}</p>
            </div>
            
            <div className="flex gap-4">
              <div className="glass-card p-5 flex-1" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] mb-1">Issue Date</p>
                <p className="font-mono text-sm text-[var(--text)]">{new Date(invoice.issue_date).toLocaleDateString()}</p>
              </div>
              <div className="glass-card p-5 flex-1" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] mb-1">Due Date</p>
                {isEditing ? (
                  <input 
                    type="date" 
                    value={editData.due_date} 
                    onChange={(e) => setEditData({...editData, due_date: e.target.value})}
                    className="w-full bg-[rgba(255,255,255,0.03)] border border-[rgba(200,180,138,0.08)] rounded p-1 text-xs font-mono text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                  />
                ) : (
                  <p className={`font-mono text-sm ${new Date(invoice.due_date) < new Date() && invoice.status !== 'Paid' ? 'text-[var(--danger)]' : 'text-[var(--text)]'}`}>
                    {new Date(invoice.due_date).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>

            <div className="glass-card p-5 border-l-2 border-l-[var(--accent)]" style={{ background: 'rgba(200,180,138,0.02)' }}>
              <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] mb-1">Amount Due</p>
              {isEditing ? (
                <input 
                  type="number" 
                  value={editData.amount} 
                  onChange={(e) => setEditData({...editData, amount: e.target.value})}
                  className="w-full bg-[rgba(255,255,255,0.03)] border border-[rgba(200,180,138,0.08)] rounded p-2 text-xl font-serif text-[var(--accent)] focus:outline-none focus:border-[var(--accent)]"
                />
              ) : (
                <p className="font-serif text-3xl text-[var(--accent)]">{formatCurrency(netAmount)}</p>
              )}
              <p className="text-xs font-mono text-[var(--muted-light)] mt-1 truncate">{invoice.quotation_service || 'Custom Service'}</p>
            </div>
            
            {isEditing && (
              <div className="flex gap-2">
                <button onClick={handleSaveEdit} className="btn-primary flex-1 py-2 text-xs font-mono uppercase tracking-widest">
                  Save Changes
                </button>
                <button onClick={() => setIsEditing(false)} className="btn-secondary flex-1 py-2 text-xs font-mono uppercase tracking-widest">
                  Cancel
                </button>
              </div>
            )}
          </div>

          <div>
            <h3 className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] mb-3">Internal Notes</h3>
            <textarea
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              onBlur={handleSaveNotes}
              placeholder="Private notes (e.g. promised to pay on Friday)..."
              className="w-full h-32 rounded-xl p-4 text-sm focus:outline-none custom-scrollbar"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(200,180,138,0.08)',
                color: 'var(--text)',
              }}
            />
            {isSaving && <p className="text-[9px] text-[var(--muted)] mt-1 ml-1 animate-pulse">Saving...</p>}
          </div>

        </div>

        {/* Actions Footer */}
        <div className="p-6 border-t border-[rgba(200,180,138,0.06)] bg-[rgba(5,5,5,0.8)] grid grid-cols-2 gap-3">
          {showDeleteConfirm ? (
            <div className="col-span-2 flex flex-col items-center p-4 glass-card bg-[rgba(255,90,90,0.05)] border-[rgba(255,90,90,0.2)]">
              <h3 className="text-[var(--danger)] font-serif text-lg mb-2">Delete this invoice?</h3>
              <p className="text-xs text-[var(--muted-light)] mb-4 text-center">This action cannot be undone and will permanently remove this invoice.</p>
              <div className="flex gap-3 w-full">
                <button onClick={() => setShowDeleteConfirm(false)} className="btn-secondary flex-1 py-2 text-xs">
                  Cancel
                </button>
                <button onClick={confirmDelete} className="btn-primary flex-1 py-2 text-xs !bg-[var(--danger)] !border-[var(--danger)] !text-white">
                  Yes, Delete
                </button>
              </div>
            </div>
          ) : (
            <>
              <button 
                onClick={handleDownloadPDF}
                className="btn-primary py-3 flex items-center justify-center gap-2 col-span-2"
              >
                <Download className="w-4 h-4" /> Download PDF
              </button>
              
              <button 
                disabled={!invoice.lead_phone}
                onClick={() => {
                  const text = `Hi ${invoice.lead_name}, this is a gentle reminder for Invoice #${invoice.invoice_number} of ${formatCurrency(netAmount)}. Please let us know if you have any questions!`;
                  const link = buildWhatsAppLink(invoice.lead_phone || '', invoice.lead_name, text);
                  window.open(link, '_blank');
                }}
                className="btn-secondary py-3 flex items-center justify-center gap-2 hover:text-[#25D366] hover:border-[#25D366] col-span-2"
              >
                <MessageCircle className="w-4 h-4" /> WhatsApp Reminder
              </button>

              {invoice.status !== 'Paid' && invoice.status !== 'Cancelled' && (
                <button 
                  onClick={() => handleStatusChange('Paid')}
                  className="btn-secondary py-3 flex items-center justify-center gap-2 hover:text-[var(--success)] hover:border-[rgba(0,196,140,0.3)]"
                >
                  <IndianRupee className="w-4 h-4" /> Mark Paid
                </button>
              )}
              
              {invoice.status !== 'Cancelled' && invoice.status !== 'Paid' && (
                <button 
                  onClick={() => handleStatusChange('Cancelled')}
                  className="btn-secondary py-3 flex items-center justify-center gap-2 hover:text-[var(--danger)] hover:border-[rgba(255,90,90,0.3)]"
                >
                  <Ban className="w-4 h-4" /> Cancel
                </button>
              )}

              {invoice.status === 'Draft' && (
                <button 
                  onClick={() => handleStatusChange('Sent')}
                  className="btn-secondary py-3 flex items-center justify-center gap-2 hover:text-[var(--warning)] hover:border-[rgba(247,185,85,0.3)] col-span-2"
                >
                  <MessageCircle className="w-4 h-4" /> Mark Sent
                </button>
              )}

              <button 
                onClick={() => setShowDeleteConfirm(true)}
                className="btn-secondary py-3 flex items-center justify-center gap-2 hover:text-[var(--danger)] hover:border-[rgba(255,90,90,0.3)] col-span-2 mt-4"
              >
                Delete Invoice
              </button>
            </>
          )}
        </div>
      </div>

      {/* Hidden container for PDF rendering */}
      <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
        <DocumentPDFTemplate ref={pdfRef} type="invoice" data={invoice} />
      </div>
    </>
  );
}
