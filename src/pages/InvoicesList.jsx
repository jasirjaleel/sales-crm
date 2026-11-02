import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Search, RefreshCw } from 'lucide-react';
import InvoiceDrawer from '../components/Finance/InvoiceDrawer';
import useMediaQuery from '../utils/useMediaQuery';

export default function InvoicesList() {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          leads ( name, email, phone ),
          quotations ( service )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const enriched = data.map(inv => ({
        ...inv,
        invoice_number: `INV-${String(inv.id).padStart(4, '0')}`,
        lead_name: inv.leads?.name || 'Unknown Lead',
        lead_email: inv.leads?.email || '',
        lead_phone: inv.leads?.phone || '',
        quotation_service: inv.quotations?.service || ''
      }));
      setInvoices(enriched);
    } catch (err) {
      console.error('Error fetching invoices:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
  };

  const renderStatusBadge = (status) => {
    const statusConfig = {
      'Draft': 'bg-[rgba(255,255,255,0.04)] text-[var(--muted-light)] border-[rgba(200,180,138,0.08)]',
      'Sent': 'bg-[rgba(247,185,85,0.1)] text-[var(--warning)] border-[rgba(247,185,85,0.2)]',
      'Paid': 'bg-[rgba(0,196,140,0.1)] text-[var(--success)] border-[rgba(0,196,140,0.2)]',
      'Cancelled': 'bg-[rgba(255,90,90,0.1)] text-[var(--danger)] border-[rgba(255,90,90,0.2)]'
    };
    const cssClass = statusConfig[status] || statusConfig['Draft'];
    return (
      <span className={`px-3 py-1 rounded-lg text-[10px] font-mono uppercase tracking-widest border ${cssClass}`}>
        {status}
      </span>
    );
  };

  const filteredInvoices = invoices.filter(inv => 
    inv.invoice_number.toLowerCase().includes(search.toLowerCase()) || 
    inv.lead_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      <div className="glass-card p-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl heading-serif text-[var(--text)]">Invoices</h1>
          <p className="text-[11px] font-mono uppercase tracking-widest text-[var(--muted-light)] mt-2">Manage client billing</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
            <input 
              type="text" 
              placeholder="Search invoices..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl text-sm text-[var(--text)] focus:outline-none placeholder-[var(--muted)]"
              style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(200, 180, 138, 0.08)' }}
            />
          </div>
          <button 
            onClick={fetchInvoices}
            className="p-2.5 rounded-xl transition-all hover:text-[var(--accent)] text-[var(--muted-light)]"
            style={{ border: '1px solid rgba(200, 180, 138, 0.08)' }}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-32">
          <div className="animate-pulse text-[var(--accent)] font-serif text-xl">Loading invoices...</div>
        </div>
      ) : filteredInvoices.length === 0 ? (
        <div className="text-center py-24 glass-card">
          <p className="text-[var(--muted)] font-mono text-sm uppercase tracking-widest mb-2">No Invoices Found</p>
          <p className="text-[var(--muted-light)] text-sm">Convert a quotation to an invoice to see it here.</p>
        </div>
      ) : isMobile ? (
        <div className="flex flex-col gap-4">
          {filteredInvoices.map(inv => (
            <div 
              key={inv.id} 
              onClick={() => setSelectedInvoiceId(inv.id)}
              className="glass-card-subtle p-5 relative overflow-hidden cursor-pointer" 
              style={{ borderRadius: '16px' }}
            >
              <div className="flex justify-between items-start mb-3">
                <div className="pr-4">
                  <h3 className="font-serif text-xl text-[var(--text)] leading-tight mb-1 truncate">{inv.lead_name}</h3>
                  <p className="text-xs font-mono text-[var(--muted)]">{inv.invoice_number}</p>
                </div>
                <div className="flex-shrink-0">{renderStatusBadge(inv.status)}</div>
              </div>

              <div className="flex justify-between items-center py-3 border-y border-[rgba(200,180,138,0.06)] mt-2">
                <div>
                  <p className="text-[9px] font-mono uppercase text-[var(--muted-light)] mb-1 tracking-widest">Due Date</p>
                  <p className={`font-mono text-sm ${new Date(inv.due_date) < new Date() && inv.status !== 'Paid' ? 'text-[var(--danger)]' : 'text-[var(--text)]'}`}>
                    {new Date(inv.due_date).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-mono uppercase text-[var(--muted-light)] mb-1 tracking-widest">Amount</p>
                  <p className="font-serif text-lg text-[var(--accent)]">{formatCurrency(inv.amount)}</p>
                </div>
              </div>
              
              {inv.quotation_service && (
                <div className="mt-3">
                  <p className="text-[9px] font-mono uppercase text-[var(--muted-light)] mb-1 tracking-widest">Service</p>
                  <p className="text-xs text-[var(--text)] truncate">{inv.quotation_service}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="glass-card overflow-hidden" style={{ borderRadius: '16px' }}>
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead style={{ background: 'rgba(5, 5, 5, 0.6)', borderBottom: '1px solid rgba(200, 180, 138, 0.06)' }}>
                <tr>
                  <th className="px-6 py-4 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Invoice #</th>
                  <th className="px-6 py-4 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Client</th>
                  <th className="px-6 py-4 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Amount</th>
                  <th className="px-6 py-4 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Due Date</th>
                  <th className="px-6 py-4 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(200,180,138,0.04)]">
                {filteredInvoices.map(inv => (
                  <tr 
                    key={inv.id} 
                    onClick={() => setSelectedInvoiceId(inv.id)}
                    className="hover:bg-[rgba(255,255,255,0.02)] transition-colors group cursor-pointer"
                  >
                    <td className="px-6 py-4">
                      <p className="font-mono text-[var(--text)]">{inv.invoice_number}</p>
                      <p className="text-[10px] font-mono text-[var(--muted)] mt-1">{new Date(inv.issue_date).toLocaleDateString()}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-serif text-[var(--text)]">{inv.lead_name}</p>
                      <p className="text-xs font-mono text-[var(--muted-light)] mt-1 truncate max-w-[200px]">{inv.quotation_service || 'Custom Invoice'}</p>
                    </td>
                    <td className="px-6 py-4 font-serif text-[var(--accent)] text-lg">{formatCurrency(inv.amount)}</td>
                    <td className="px-6 py-4">
                      <p className={`font-mono text-sm ${new Date(inv.due_date) < new Date() && inv.status !== 'Paid' ? 'text-[var(--danger)]' : 'text-[var(--text)]'}`}>
                        {new Date(inv.due_date).toLocaleDateString()}
                      </p>
                    </td>
                    <td className="px-6 py-4">{renderStatusBadge(inv.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedInvoiceId && invoices.some(i => i.id === selectedInvoiceId) && (
        <InvoiceDrawer
          invoice={invoices.find(i => i.id === selectedInvoiceId)}
          onClose={() => { setSelectedInvoiceId(null); fetchInvoices(); }} 
        />
      )}
    </div>
  );
}
