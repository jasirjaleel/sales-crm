import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import { stageLabel } from '../utils/pipeline';
import { notifyError } from '../lib/notify';

const formatINR = (amount) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);

function Tile({ label, value, note }) {
  return (
    <div className="card-primitive p-5">
      <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] mb-2">{label}</p>
      <p className="text-2xl font-medium tracking-tight text-[var(--text)]">{value}</p>
      {note && <p className="text-[11px] text-[var(--muted-light)] mt-1">{note}</p>}
    </div>
  );
}

const pdfCell = { padding: '8px 10px', borderBottom: '1px solid #E5E5E5', fontSize: '12px', textAlign: 'left' };

export default function OwnerSummary({ summary, report }) {
  const pdfRef = useRef(null);
  const [downloading, setDownloading] = useState(false);

  const winRate = summary.winRate === null ? 'No data' : `${summary.winRate}%`;
  const kpis = [
    { label: 'Open Pipeline', value: formatINR(summary.pipelineValue), note: `${summary.openDeals} deals with a value` },
    { label: 'Weighted Forecast', value: formatINR(summary.forecast), note: 'Contacted 10%, Interested 25%, Meeting 50%, Proposal 75%' },
    { label: 'Win Rate', value: winRate, note: `${summary.won} won, ${summary.lost} lost` },
    { label: 'Collected This Month', value: formatINR(summary.collectedThisMonth), note: 'Paid invoices' },
    { label: 'Outstanding', value: formatINR(summary.outstanding), note: `${formatINR(summary.overdue)} overdue` },
    { label: 'Deals at Risk', value: summary.atRiskCount, note: `${formatINR(summary.atRiskValue)} in value` },
  ];

  const downloadPdf = async () => {
    setDownloading(true);
    try {
      await html2pdf().set({
        margin: 0.4,
        filename: `business-report-${new Date().toISOString().split('T')[0]}.pdf`,
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' },
      }).from(pdfRef.current).save();
    } catch (err) {
      notifyError(err, 'Could not create the PDF.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <section className="space-y-4" aria-label="Owner summary">
      <div className="flex justify-between items-center gap-4">
        <h2 className="text-lg heading-serif text-[var(--text)]">Business Summary</h2>
        <button onClick={downloadPdf} disabled={downloading} className="btn-secondary px-3 py-2 text-[10px] font-mono uppercase tracking-widest flex items-center gap-2 disabled:opacity-50">
          <Download className="w-3.5 h-3.5" /> {downloading ? 'Creating...' : 'Download PDF'}
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {kpis.map(k => <Tile key={k.label} {...k} />)}
      </div>

      <div className="card-primitive p-6">
        <h3 className="text-lg heading-serif text-[var(--text)] mb-1">Deals at Risk</h3>
        <p className="text-xs text-[var(--muted-light)] mb-4">Interested or further, idle for 7+ days or past their expected close date</p>
        {summary.atRisk.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Nothing at risk right now.</p>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="border-b border-[var(--border-subtle)]">
                  {['Deal', 'Stage', 'Owner', 'Value', 'Why'].map(h => (
                    <th key={h} scope="col" className="py-2 pr-6 font-mono text-[10px] uppercase tracking-widest text-[var(--muted)] font-normal">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summary.atRisk.map(d => (
                  <tr key={d.id} className="border-b border-[var(--border-subtle)] last:border-0">
                    <td className="py-2.5 pr-6 text-[var(--text)]">{d.name}</td>
                    <td className="py-2.5 pr-6 text-[var(--muted-light)]">{stageLabel(d.stage)}</td>
                    <td className="py-2.5 pr-6 text-[var(--muted-light)]">{d.owner || 'Unassigned'}</td>
                    <td className="py-2.5 pr-6 font-mono text-[var(--text)]">{formatINR(d.deal_value)}</td>
                    <td className="py-2.5 pr-6 text-[var(--muted-light)]">{d.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Link to="/leads/pipeline" className="inline-block mt-4 text-[10px] font-mono uppercase tracking-widest text-[var(--muted-light)] hover:text-[var(--text)]">
          Open Pipeline &rarr;
        </Link>
      </div>

      {/* Light, print-friendly copy used only for the PDF */}
      <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', top: 0 }}>
        <div ref={pdfRef} style={{ width: '720px', padding: '24px', background: '#FFFFFF', color: '#1A1A1A', fontFamily: 'Arial, sans-serif' }}>
          <h1 style={{ fontSize: '22px', margin: '0 0 4px' }}>Business Report</h1>
          <p style={{ fontSize: '12px', color: '#555', margin: '0 0 20px' }}>
            {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px' }}>
            <tbody>
              {kpis.map(k => (
                <tr key={k.label}>
                  <td style={pdfCell}>{k.label}</td>
                  <td style={{ ...pdfCell, fontWeight: 'bold' }}>{k.value}</td>
                  <td style={{ ...pdfCell, color: '#555' }}>{k.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h2 style={{ fontSize: '15px', margin: '0 0 8px' }}>Deals at Risk</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px' }}>
            <tbody>
              {summary.atRisk.length === 0 && <tr><td style={pdfCell}>Nothing at risk right now.</td></tr>}
              {summary.atRisk.map(d => (
                <tr key={d.id}>
                  <td style={pdfCell}>{d.name}</td>
                  <td style={pdfCell}>{stageLabel(d.stage)}</td>
                  <td style={pdfCell}>{formatINR(d.deal_value)}</td>
                  <td style={pdfCell}>{d.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h2 style={{ fontSize: '15px', margin: '0 0 8px' }}>Team Performance, last {report.days} days of calls</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{['Name', 'Calls', 'Leads', 'Meetings', 'Won', 'Won Value'].map(h => <th key={h} style={pdfCell}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {report.agents.map(a => (
                <tr key={a.id}>
                  <td style={pdfCell}>{a.name}</td>
                  <td style={pdfCell}>{a.calls}</td>
                  <td style={pdfCell}>{a.assigned}</td>
                  <td style={pdfCell}>{a.meetings}</td>
                  <td style={pdfCell}>{a.won}</td>
                  <td style={pdfCell}>{formatINR(a.won_value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
