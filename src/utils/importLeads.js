// Splits mapped rows into what to insert, with the numbers shown on the import summary.
export function prepareImport(mappedLeads, existingPhones = new Set()) {
  const seen = new Set(existingPhones);
  const unique = [];
  let duplicates = 0;
  let empty = 0;

  for (const lead of mappedLeads) {
    if (!lead.name && !lead.phone) {
      empty++;
      continue;
    }
    if (lead.phone) {
      if (seen.has(lead.phone)) {
        duplicates++;
        continue;
      }
      seen.add(lead.phone);
    }
    unique.push(lead);
  }

  return {
    leads: unique,
    stats: {
      importedCount: unique.length,
      validNumbers: unique.filter(l => l.phone).length,
      missingNumbers: unique.filter(l => !l.phone).length,
      websitesFound: unique.filter(l => l.website).length,
      noWebsite: unique.filter(l => !l.website).length,
      duplicatesRemoved: duplicates,
      emptyRows: empty,
    },
  };
}

export function chunk(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}
