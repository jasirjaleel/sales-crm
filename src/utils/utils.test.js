import { describe, it, expect, beforeEach, vi } from 'vitest';
import { autoMapColumns } from './columnMapper';
import { normalizePhone, toWhatsAppNumber } from './phone';
import { buildWhatsAppLink } from './whatsapp';
import { prepareImport, chunk } from './importLeads';
import { buildLeadsCSV } from './exportCSV';
import { normalizeStage, stageAfterOutcome, resolveOutcome, followUpTime } from './pipeline';

describe('autoMapColumns', () => {
  it.each([
    ['Business Name', 'name'],
    ['Business Type', 'businessType'],
    ['Phone Number', 'phone'],
    ['Number of Reviews', 'reviews'],
    ['Google Maps Link', 'googleMapsUrl'],
    ['Review Count', 'reviews'],
    ['Average Rating', 'averageRating'],
    ['Website', 'website'],
    ['Address', 'location'],
    ['Graph', 'skip'],
    ['Hotel Name', 'name'],
  ])('maps %s to %s', (header, field) => {
    expect(autoMapColumns([header])).toEqual([field]);
  });

  it('maps a field only once so a second column cannot overwrite it', () => {
    expect(autoMapColumns(['Phone', 'Mobile'])).toEqual(['phone', 'skip']);
  });
});

describe('normalizePhone', () => {
  it.each([
    ['98765 43210', '9876543210'],
    ['+91 98765-43210', '9876543210'],
    ['919876543210', '9876543210'],
    ['09876543210', '9876543210'],
    ['+971 50 123 4567', '+971501234567'],
    ['00971501234567', '+971501234567'],
    ['12345', ''],
    ['', ''],
    [null, ''],
  ])('%s becomes %s', (raw, expected) => {
    expect(normalizePhone(raw)).toBe(expected);
  });

  it('keeps a 10-digit number that happens to start with 91', () => {
    expect(normalizePhone('9198765432')).toBe('9198765432');
  });
});

describe('toWhatsAppNumber', () => {
  it('adds India only to domestic numbers', () => {
    expect(toWhatsAppNumber('9876543210')).toBe('919876543210');
    expect(toWhatsAppNumber('9198765432')).toBe('919198765432');
    expect(toWhatsAppNumber('+971501234567')).toBe('971501234567');
  });
});

describe('buildWhatsAppLink', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', { getItem: () => 'Hi {{name}}, hello' });
  });

  it('fills the template', () => {
    expect(decodeURIComponent(buildWhatsAppLink('9876543210', 'Cafe'))).toBe('https://wa.me/919876543210?text=Hi Cafe, hello');
  });

  it('handles a missing name', () => {
    expect(decodeURIComponent(buildWhatsAppLink('9876543210', ''))).toContain('text=Hi, hello');
  });

  it('sends a custom message as written', () => {
    expect(decodeURIComponent(buildWhatsAppLink('9876543210', 'Cafe', 'Invoice due'))).toContain('text=Invoice due');
  });
});

describe('prepareImport', () => {
  it('removes duplicates in the file and against the CRM, and counts honestly', () => {
    const { leads, stats } = prepareImport([
      { name: 'A', phone: '1111111111', website: 'a.com' },
      { name: 'A again', phone: '1111111111' },
      { name: 'Already in CRM', phone: '2222222222' },
      { name: 'No phone', phone: '' },
      { name: '', phone: '' },
    ], new Set(['2222222222']));

    expect(leads.map(l => l.name)).toEqual(['A', 'No phone']);
    expect(stats).toEqual({
      importedCount: 2, validNumbers: 1, missingNumbers: 1, websitesFound: 1, noWebsite: 1, duplicatesRemoved: 2, emptyRows: 1,
    });
  });

  it('chunks', () => {
    expect(chunk([1, 2, 3], 2)).toEqual([[1, 2], [3]]);
  });
});

describe('buildLeadsCSV', () => {
  it('quotes values and neutralises spreadsheet formulas', () => {
    const csv = buildLeadsCSV([{ name: '=HYPERLINK("x")', phone: '+971501234567', notes: 'a "b"' }]);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).toContain('"+971501234567"');
    expect(csv).toContain('"a ""b"""');
  });
});

describe('pipeline', () => {
  it('maps old statuses', () => {
    expect(normalizeStage('no_answer')).toBe('contacted');
    expect(normalizeStage('closed')).toBe('won');
    expect(normalizeStage('not_interested')).toBe('lost');
    expect(normalizeStage('interested')).toBe('interested');
  });

  it('moves a new lead to contacted after a call', () => {
    expect(stageAfterOutcome('new', 'no_answer')).toBe('contacted');
  });

  it('never moves a lead backwards on a call', () => {
    expect(stageAfterOutcome('meeting_booked', 'no_answer')).toBe('meeting_booked');
    expect(stageAfterOutcome('won', 'not_interested')).toBe('won');
  });

  it('records a reason when a call loses the lead', () => {
    expect(stageAfterOutcome('interested', 'skip_bad_number')).toBe('lost');
    expect(resolveOutcome('skip_bad_number').lostReason).toBe('Bad Number');
  });

  it('treats Call Later as a follow-up, not a lost lead', () => {
    expect(stageAfterOutcome('new', 'skip_call_later')).toBe('contacted');
    expect(resolveOutcome('skip_call_later').followUp).toBe('tomorrow_10am');
  });

  it('schedules follow-ups', () => {
    const now = new Date(2026, 10, 2, 15, 0);
    expect(followUpTime('in_1h', now).getHours()).toBe(16);
    expect(followUpTime('tomorrow_10am', now)).toEqual(new Date(2026, 10, 3, 10, 0));
    expect(followUpTime(undefined, now)).toBeNull();
  });
});
