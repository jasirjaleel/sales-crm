// Excel runs cells starting with these as formulas, so an imported business name could execute.
function csvCell(value) {
  const text = String(value ?? '');
  const safe = /^[=+\-@\t\r]/.test(text) && !/^\+?\d[\d\s-]*$/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function buildLeadsCSV(leads) {
  const headers = [
    'Name', 'Phone', 'Email', 'Website', 'Location',
    'Category', 'Business Type', 'Stage', 'Last Outcome', 'Lost Reason',
    'Deal Value', 'Average Rating', 'Reviews', 'Rating Score', 'Notes'
  ];

  const rows = leads.map(l => [
    l.name,
    l.phone,
    l.email,
    l.website,
    l.location,
    l.category,
    l.business_type,
    l.status,
    l.last_outcome,
    l.lost_reason,
    l.deal_value,
    l.average_rating,
    l.reviews,
    l.ai_score,
    l.notes
  ]);

  return [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\n');
}

export function exportLeadsAsCSV(leads, filename = 'leads-export.csv') {
  // The BOM tells Excel this is UTF-8, otherwise non-English text comes out garbled.
  const blob = new Blob(['﻿', buildLeadsCSV(leads)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
