import { useState } from 'react';
import { TARGET_FIELDS, autoMapColumns, calculateScore } from '../../utils/columnMapper';
import { normalizePhone } from '../../utils/phone';

export default function ColumnMapper({ headers, rows, onConfirm, onCancel }) {
  // Fresh headers mean a fresh file, and CSVUpload remounts this component for each one
  const [mapping, setMapping] = useState(() => autoMapColumns(headers));

  const handleMappingChange = (colIndex, newField) => {
    const newMapping = [...mapping];
    newMapping[colIndex] = newField;
    setMapping(newMapping);
  };

  const hasRequiredFields = mapping.includes('name') && mapping.includes('phone');

  const handleConfirm = () => {
    // Transform rows using the mapping
    const mappedLeads = rows.map(row => {
      const lead = {
        name: '',
        phone: '',
        website: '',
        location: '',
        googleMapsUrl: '',
        businessType: '',
        category: '',
        reviews: 0,
        averageRating: 0,
        notes: ''
      };

      row.forEach((cell, index) => {
        const field = mapping[index];
        if (field && field !== 'skip') {
          if (field === 'reviews') {
            lead[field] = Math.abs(parseInt(cell, 10)) || 0;
          } else if (field === 'averageRating') {
            lead[field] = Math.round(parseFloat(cell) * 10) / 10 || 0;
          } else {
            lead[field] = String(cell).trim();
          }
        }
      });

      // Calculate score
      lead.aiScore = calculateScore(lead.averageRating, lead.reviews);
      
      // Clean phone number
      lead.phone = normalizePhone(lead.phone);
      lead.phoneValid = !!lead.phone;
      lead.incomplete = !lead.phone || !lead.name;

      return lead;
    });

    onConfirm(mappedLeads);
  };

  return (
    <div className="glass-card p-10">
      <div className="flex justify-between items-end mb-10 pb-6 border-b border-[rgba(200,180,138,0.06)]">
        <div>
          <h2 className="text-3xl font-serif text-[var(--text)] tracking-tight">Map Columns</h2>
          <p className="text-[var(--muted-light)] font-mono text-[11px] uppercase tracking-widest mt-3">
            Match {headers.length} columns to CRM fields
          </p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={onCancel}
            className="btn-secondary px-6 py-2.5 font-mono text-xs uppercase tracking-widest"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!hasRequiredFields}
            className="btn-primary px-6 py-2.5 font-mono text-xs uppercase tracking-widest disabled:opacity-30"
          >
            Confirm & Import
          </button>
        </div>
      </div>
      
      {!hasRequiredFields && (
        <div className="mb-8 p-4 rounded-xl text-sm font-sans flex gap-3 text-[var(--danger)]" style={{ background: 'rgba(255,90,90,0.06)', border: '1px solid rgba(255,90,90,0.15)' }}>
          <span className="text-xl">⚠️</span> 
          <span>Please map at least <strong>Business Name</strong> and <strong>Phone Number</strong> to proceed.</span>
        </div>
      )}

      <div className="mb-12 overflow-hidden rounded-2xl" style={{ border: '1px solid rgba(200,180,138,0.08)' }}>
        <table className="w-full text-left text-sm">
          <thead style={{ background: 'rgba(5, 5, 5, 0.6)', borderBottom: '1px solid rgba(200, 180, 138, 0.06)' }}>
            <tr>
              <th className="px-6 py-4 text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--muted)] w-1/4">Column Label</th>
              <th className="px-6 py-4 text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--muted)] w-2/4">Data Preview</th>
              <th className="px-6 py-4 text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--muted)] w-1/4">Map To Field</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[rgba(200,180,138,0.04)]">
            {headers.map((header, i) => (
              <tr key={i} className="hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                <td className="px-6 py-5 text-[var(--text)] font-serif text-lg truncate">{header}</td>
                <td className="px-6 py-5 text-[var(--muted)] font-mono text-xs truncate">
                  <div className="flex flex-col gap-2">
                    {rows[0] && rows[0][i] ? <span>{String(rows[0][i]).substring(0, 50)}</span> : null}
                    {rows[1] && rows[1][i] ? <span className="opacity-50">{String(rows[1][i]).substring(0, 50)}</span> : null}
                  </div>
                </td>
                <td className="px-6 py-5">
                  <select
                    value={mapping[i] || 'skip'}
                    onChange={(e) => handleMappingChange(i, e.target.value)}
                    className="w-full px-4 py-3 rounded-xl text-[var(--text)] font-sans text-sm focus:outline-none"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(200,180,138,0.10)' }}
                  >
                    {TARGET_FIELDS.map(f => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <h3 className="text-xl font-serif text-[var(--text)] mb-6">Live Data Preview</h3>
        <div className="overflow-x-auto rounded-2xl custom-scrollbar" style={{ border: '1px solid rgba(200,180,138,0.08)' }}>
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead style={{ background: 'rgba(5, 5, 5, 0.6)', borderBottom: '1px solid rgba(200, 180, 138, 0.06)' }}>
              <tr>
                {headers.map((_, i) => {
                  const mappedField = mapping[i];
                  const isMapped = mappedField && mappedField !== 'skip';
                  const label = isMapped ? TARGET_FIELDS.find(f => f.value === mappedField)?.label : 'Ignored';
                  
                  return (
                    <th key={i} className={`px-6 py-4 text-[10px] font-mono uppercase tracking-[0.2em] ${isMapped ? 'text-[var(--accent)]' : 'text-[#333]'}`}>
                      {label}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(200,180,138,0.04)]">
              {rows.slice(0, 3).map((row, rowIndex) => (
                <tr key={rowIndex} className="hover:bg-[rgba(255,255,255,0.02)]">
                  {row.map((cell, cellIndex) => {
                    const field = mapping[cellIndex];
                    const isMapped = field && field !== 'skip';
                    let displayValue = cell;
                    
                    if (isMapped) {
                      if (field === 'reviews') {
                        displayValue = Math.abs(parseInt(cell, 10)) || 0;
                      } else if (field === 'averageRating') {
                        displayValue = Math.round(parseFloat(cell) * 10) / 10 || 0;
                      } else if (field === 'phone') {
const cleanPhone = normalizePhone(cell) || 'Invalid';
                        displayValue = cleanPhone;
                      }
                    }

                    return (
                      <td key={cellIndex} className={`px-6 py-4 truncate max-w-[200px] font-sans ${isMapped ? 'text-[var(--text)]' : 'text-[#333]'}`}>
                        {displayValue}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
