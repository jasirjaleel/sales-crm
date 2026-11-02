import Papa from 'papaparse';

export function parseCSV(file) {
  return new Promise((resolve) => {
    Papa.parse(file, {
      header: false,      // always false — we detect manually
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data;
        if (rows.length === 0) {
          resolve({ headers: [], rows: [], detectedHeader: false });
          return;
        }

        const firstRow = rows[0];
        const looksLikeHeader = firstRow.every(cell => {
          const s = String(cell).trim();
          const isPhone = /^[\d\s+\-()]{7,}$/.test(s);
          const isURL   = /https?|www\.|\.com|\.in/.test(s);
          const isNum   = /^\d+(\.\d+)?$/.test(s);
          return !isPhone && !isURL && !isNum && s.length < 50;
        });

        if (looksLikeHeader) {
          resolve({
            headers: firstRow,
            rows: rows.slice(1),    // remove header from data
            detectedHeader: true
          });
        } else {
          resolve({
            headers: firstRow.map((_, i) => `Column ${i + 1}`),
            rows: rows,             // keep all rows as data
            detectedHeader: false
          });
        }
      }
    });
  });
}
