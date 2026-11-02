import { useState, useRef, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { UploadCloud, CheckCircle, FileSpreadsheet, Plus, FolderOpen } from 'lucide-react';
import { parseCSV } from '../../utils/csvParser';
import ColumnMapper from './ColumnMapper';
import { prepareImport, chunk } from '../../utils/importLeads';

export default function CSVUpload() {
  const [file, setFile] = useState(null);
  
  const [uploadMode, setUploadMode] = useState('new'); // 'new' or 'existing'
  const [existingLists, setExistingLists] = useState([]);
  const [selectedListId, setSelectedListId] = useState('');
  
  const [listName, setListName] = useState('');
  const [category, setCategory] = useState('Other');
  const [description, setDescription] = useState('');
  
  const [isParsing, setIsParsing] = useState(false);
  const [parsedData, setParsedData] = useState(null); 

  const fetchLists = async () => {
    try {
      const { data } = await supabase.from('lead_lists').select('*');
      if (data) {
        setExistingLists(data);
        if (data.length > 0) setSelectedListId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch lists', err);
    }
  };

  useEffect(() => {
    fetchLists();
  }, []);
  
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [importStats, setImportStats] = useState(null);
  
  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      if (!listName) {
        setListName(selectedFile.name.replace('.csv', ''));
      }
      
      setError('');
      setIsParsing(true);
      try {
        const result = await parseCSV(selectedFile);
        if (result.rows.length === 0) {
          setError('CSV file is empty or invalid.');
        } else {
          setParsedData(result);
        }
      } catch {
        setError('Error parsing CSV file.');
      } finally {
        setIsParsing(false);
      }
    }
  };

  const handleConfirmMapping = async (mappedLeads) => {
    if (!mappedLeads || mappedLeads.length === 0) return;
    
    setError('');
    setIsUploading(true);
    
    let createdListId = null;
    let insertedCount = 0;

    try {
      // Phones already in the CRM, looked up in batches to keep each request small
      const existingPhones = new Set();
      const phones = [...new Set(mappedLeads.map(l => l.phone).filter(Boolean))];
      for (const batch of chunk(phones, 200)) {
        const { data, error: lookupError } = await supabase.from('leads').select('phone').in('phone', batch);
        if (lookupError) throw lookupError;
        (data || []).forEach(l => existingPhones.add(l.phone));
      }

      const { leads: uniqueLeads, stats } = prepareImport(mappedLeads, existingPhones);
      if (uniqueLeads.length === 0) {
        setImportStats(stats);
        setFile(null);
        setParsedData(null);
        setListName('');
        return;
      }

      let currentListId = selectedListId;
      if (uploadMode === 'new') {
        const { data: newList, error: listError } = await supabase.from('lead_lists').insert({
          name: listName,
          category: category,
          description: description
        }).select().single();
        if (listError) throw listError;
        currentListId = newList.id;
        createdListId = newList.id;
      }

      const leadsToInsert = uniqueLeads.map(lead => ({
list_id: currentListId,
        name: lead.name,
        phone: lead.phone,
        website: lead.website,
        location: lead.location,
        google_maps_url: lead.googleMapsUrl,
        business_type: lead.businessType,
        category: lead.category,
        reviews: lead.reviews,
        average_rating: lead.averageRating,
        notes: lead.notes,
        status: 'new',
        ai_score: lead.aiScore,
        phone_valid: lead.phoneValid ? 1 : 0,
        incomplete: lead.incomplete ? 1 : 0
      }));

      for (const batch of chunk(leadsToInsert, 500)) {
        const { error: insertError } = await supabase.from('leads').insert(batch);
        if (insertError) throw insertError;
        insertedCount += batch.length;
      }

      setImportStats(stats);
      setFile(null);
      setParsedData(null);
      setListName('');
    } catch (err) {
      console.error('Import Error Full Details:', err);
      if (err.details) console.error('Details:', err.details);
      if (err.hint) console.error('Hint:', err.hint);
      // Don't leave an empty list behind when nothing made it in
      if (createdListId && insertedCount === 0) {
        await supabase.from('lead_lists').delete().eq('id', createdListId);
      }
      const partial = insertedCount > 0 ? ` ${insertedCount} leads were imported before the error.` : '';
      setError(`Database Error: ${err.message || 'Error importing leads'}.${partial}`);
} finally {
      setIsUploading(false);
    }
  };

  const handleCancelMapping = () => {
    setFile(null);
    setParsedData(null);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500 pb-12">
      
      <div className="border-b border-[rgba(200,180,138,0.06)] pb-6">
        <h1 className="text-4xl heading-serif text-[var(--text)]">Import Leads.</h1>
        <p className="text-[var(--muted)] mt-2 font-mono text-sm tracking-wider uppercase">Upload a CSV file to enrich your CRM</p>
      </div>
      
      {importStats ? (
        <div className="glass-card p-12 text-center relative overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full blur-3xl pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(0, 196, 140, 0.06) 0%, transparent 70%)' }}
          ></div>
          <CheckCircle className="w-16 h-16 text-[var(--success)] mx-auto mb-6 relative z-10" />
          <h2 className="text-3xl font-serif text-[var(--text)] mb-8 relative z-10">Import Complete</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6 text-left mb-10 max-w-2xl mx-auto relative z-10">
            <div className="p-4 rounded-xl bg-[rgba(255,255,255,0.02)] border border-[rgba(200,180,138,0.1)]">
              <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--muted)] mb-2">Imported Leads</div>
              <div className="text-2xl font-serif text-[var(--text)]">{importStats.importedCount}</div>
            </div>
            <div className="p-4 rounded-xl bg-[rgba(255,255,255,0.02)] border border-[rgba(200,180,138,0.1)]">
              <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--muted)] mb-2">Valid Numbers</div>
              <div className="text-2xl font-serif text-[var(--success)]">{importStats.validNumbers}</div>
            </div>
            <div className="p-4 rounded-xl bg-[rgba(255,255,255,0.02)] border border-[rgba(200,180,138,0.1)]">
              <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--muted)] mb-2">Missing Numbers</div>
              <div className="text-2xl font-serif text-[#ef4444]">{importStats.missingNumbers}</div>
            </div>
            <div className="p-4 rounded-xl bg-[rgba(255,255,255,0.02)] border border-[rgba(200,180,138,0.1)]">
              <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--muted)] mb-2">Websites Found</div>
              <div className="text-2xl font-serif text-[var(--text)]">{importStats.websitesFound}</div>
            </div>
            <div className="p-4 rounded-xl bg-[rgba(255,255,255,0.02)] border border-[rgba(200,180,138,0.1)]">
              <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--muted)] mb-2">No Website</div>
              <div className="text-2xl font-serif text-[var(--muted)]">{importStats.noWebsite}</div>
            </div>
            <div className="p-4 rounded-xl bg-[rgba(255,255,255,0.02)] border border-[rgba(200,180,138,0.1)]">
              <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--muted)] mb-2">Duplicates Removed</div>
              <div className="text-2xl font-serif text-[var(--accent)]">{importStats.duplicatesRemoved}</div>
            </div>
          </div>
          
          <button 
            onClick={() => setImportStats(null)}
            className="btn-secondary px-8 py-3 font-mono text-xs uppercase tracking-widest relative z-10 hover:text-[var(--success)] hover:border-[rgba(0,196,140,0.20)]"
          >
            Upload Another List
          </button>
        </div>
      ) : !parsedData ? (
        <div className="glass-card p-10">
          <div className="space-y-10">
            <div className="flex gap-4 p-1.5 rounded-xl bg-[rgba(255,255,255,0.02)] border border-[rgba(200,180,138,0.08)] mb-6 max-w-md mx-auto">
              <button 
                className={`flex-1 py-2.5 rounded-lg text-xs font-mono uppercase tracking-widest transition-all ${uploadMode === 'new' ? 'bg-[var(--accent)] text-[#050505]' : 'text-[var(--muted)] hover:text-[var(--text)]'}`}
                onClick={() => setUploadMode('new')}
              >
                <div className="flex items-center justify-center gap-2"><Plus className="w-3.5 h-3.5" /> New List</div>
              </button>
              <button 
                className={`flex-1 py-2.5 rounded-lg text-xs font-mono uppercase tracking-widest transition-all ${uploadMode === 'existing' ? 'bg-[var(--accent)] text-[#050505]' : 'text-[var(--muted)] hover:text-[var(--text)]'}`}
                onClick={() => setUploadMode('existing')}
              >
                <div className="flex items-center justify-center gap-2"><FolderOpen className="w-3.5 h-3.5" /> Existing List</div>
              </button>
            </div>

            {uploadMode === 'new' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--muted)] mb-3">List Name</label>
                  <input
                    type="text"
                    value={listName}
                    onChange={(e) => setListName(e.target.value)}
                    placeholder="e.g. Kozhikode Interior Designers"
                    className="w-full px-4 py-3 rounded-xl text-[var(--text)] focus:outline-none font-sans placeholder-[var(--muted)] transition-all"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(200,180,138,0.10)' }}
                  />
                </div>
                
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--muted)] mb-3">Default Category</label>
                  <select 
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl text-[var(--text)] focus:outline-none font-sans"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(200,180,138,0.10)' }}
                  >
                    <option value="Interior Design">Interior Design</option>
                    <option value="Car Wash">Car Wash</option>
                    <option value="Ayurvedic/Wellness">Ayurvedic/Wellness</option>
                    <option value="Restaurant">Restaurant</option>
                    <option value="Retail">Retail</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--muted)] mb-3">Description (Optional)</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. Generated from local Google Maps scrape"
                    className="w-full px-4 py-3 rounded-xl text-[var(--text)] focus:outline-none font-sans placeholder-[var(--muted)] transition-all"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(200,180,138,0.10)' }}
                  />
                </div>
              </div>
            ) : (
              <div className="max-w-2xl mx-auto">
                <label className="block text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--muted)] mb-3 text-center">Select Existing List</label>
                <select 
                  value={selectedListId}
                  onChange={(e) => setSelectedListId(e.target.value)}
                  className="w-full px-4 py-4 rounded-xl text-[var(--text)] focus:outline-none font-sans text-center"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(200,180,138,0.10)' }}
                >
                  {existingLists.length === 0 ? (
                    <option value="">No lists found. Please create one.</option>
                  ) : (
                    existingLists.map(list => (
                      <option key={list.id} value={list.id}>
                        {list.name} ({list.total_leads} leads) - {list.category}
                      </option>
                    ))
                  )}
                </select>
              </div>
            )}

            <div 
              className={`border border-dashed rounded-2xl p-20 flex flex-col items-center justify-center text-center transition-all cursor-pointer group ${file ? '' : ''}`}
              style={{
                borderColor: file ? 'rgba(200,180,138,0.25)' : 'rgba(200,180,138,0.10)',
                background: file ? 'rgba(200,180,138,0.04)' : 'rgba(255,255,255,0.02)',
              }}
              onClick={() => fileInputRef.current?.click()}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(200,180,138,0.25)'; e.currentTarget.style.background = 'rgba(200,180,138,0.04)'; }}
              onMouseLeave={(e) => { if (!file) { e.currentTarget.style.borderColor = 'rgba(200,180,138,0.10)'; e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; } }}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept=".csv" 
                className="hidden" 
              />
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform"
                style={{ background: 'rgba(200,180,138,0.06)', border: '1px solid rgba(200,180,138,0.12)' }}
              >
                {file ? <FileSpreadsheet className="w-8 h-8 text-[var(--accent)]" /> : <UploadCloud className="w-8 h-8 text-[var(--muted-light)] group-hover:text-[var(--accent)]" />}
              </div>
              <p className="text-[var(--text)] font-serif text-2xl mb-3">
                {file ? file.name : "Select or drop CSV file here"}
              </p>
              <p className="text-[var(--muted)] font-mono text-xs uppercase tracking-widest">
                {isParsing ? 'Parsing CSV...' : 'Requires a header row.'}
              </p>
            </div>

            {error && (
              <div className="p-4 rounded-xl text-sm font-sans flex items-center gap-3 text-[var(--danger)]" style={{ background: 'rgba(255,90,90,0.08)', border: '1px solid rgba(255,90,90,0.15)' }}>
                <CheckCircle className="w-5 h-5 text-[var(--danger)]" /> {error}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="glass-card-subtle flex justify-between items-center px-6 py-5" style={{ borderRadius: '14px' }}>
            <span className="text-[11px] font-mono uppercase tracking-widest text-[var(--success)] flex items-center gap-3">
              <CheckCircle className="w-4 h-4" />
              {parsedData.detectedHeader ? 'Header Auto-Detected' : 'Columns Auto-Labeled'}
            </span>
            <span className="px-3 py-1.5 rounded-lg text-[11px] font-mono uppercase tracking-widest text-[var(--muted-light)]"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(200,180,138,0.08)' }}
            >
              {parsedData.rows.length} Records Found
            </span>
          </div>

          {isUploading ? (
            <div className="glass-card p-20 text-center flex flex-col items-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--accent)] mb-8"></div>
              <h3 className="text-2xl font-serif text-[var(--text)] mb-3">Persisting to Database...</h3>
              <p className="text-[11px] font-mono uppercase tracking-widest text-[var(--muted)]">Please do not close this window</p>
            </div>
          ) : (
            <ColumnMapper 
              headers={parsedData.headers} 
              rows={parsedData.rows} 
              onConfirm={handleConfirmMapping}
              onCancel={handleCancelMapping}
            />
          )}
        </div>
      )}
    </div>
  );
}
