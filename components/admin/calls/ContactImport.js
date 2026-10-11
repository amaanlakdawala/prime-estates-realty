'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { importContacts } from '@/app/admin/calls/actions';

const TEMPLATE = 'name,phone,why_calling,looking_for\nRahul Sharma,9820012345,Enquired on 99acres,2 BHK Powai around 2 crore\nPriya Mehta,9876543210,Visited our office,\n';

// Minimal CSV reader: commas, quoted fields with "" escapes, CRLF or LF line endings.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((f) => f.trim()));
}

// Finds the columns by their header names, so column order and extra columns don't matter.
function toContacts(rows) {
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (...names) => header.findIndex((h) => names.some((n) => h.includes(n)));
  const phone = col('phone', 'mobile', 'number', 'contact');
  if (phone === -1) throw new Error('The file needs a column named "phone" (or "mobile").');
  const name = col('name');
  const context = col('why', 'reason', 'context', 'source');
  const notes = col('looking', 'requirement', 'notes', 'need');
  return rows.slice(1).map((r) => ({
    phone: r[phone] ?? '',
    name: name >= 0 ? r[name] ?? '' : '',
    context: context >= 0 ? r[context] ?? '' : '',
    notes: notes >= 0 ? r[notes] ?? '' : '',
  }));
}

export default function ContactImport() {
  const router = useRouter();
  const [contacts, setContacts] = useState(null);
  const [fileName, setFileName] = useState('');
  const [consent, setConsent] = useState(false);
  const [message, setMessage] = useState(null);
  const [pending, startTransition] = useTransition();

  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    setMessage(null);
    setContacts(null);
    if (!file) return;
    try {
      const rows = parseCsv(await file.text());
      if (rows.length < 2) throw new Error('The file has no contacts below the header row.');
      setContacts(toContacts(rows));
      setFileName(file.name);
    } catch (err) {
      setMessage({ error: true, text: err.message });
    }
  }

  function upload() {
    setMessage(null);
    startTransition(async () => {
      const result = await importContacts(contacts, consent);
      if (result?.error) return setMessage({ error: true, text: result.error });
      const extra = [
        result.alreadyListed && `${result.alreadyListed} already in your list`,
        result.duplicatesInFile && `${result.duplicatesInFile} repeated in the file`,
        result.invalid && `${result.invalid} without a valid mobile number`,
      ].filter(Boolean).join(', ');
      setMessage({ text: `Added ${result.added} contacts.${extra ? ` Skipped: ${extra}.` : ''}` });
      setContacts(null);
      setConsent(false);
      router.refresh();
    });
  }

  const templateHref = `data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE)}`;

  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted">
        A CSV file with a <span className="font-semibold">phone</span> column, plus optional name, why you&apos;re calling and what they&apos;re looking for.
        In Excel use File → Save As → CSV. <a href={templateHref} download="ai-call-contacts.csv" className="font-medium text-teal underline">Download a template</a>.
      </p>
      <label className="btn-outline cursor-pointer">
        Choose CSV file
        <input type="file" accept=".csv,text/csv" className="sr-only" onChange={onFile} />
      </label>
      {contacts && (
        <div className="space-y-3 rounded-lg bg-stone p-3">
          <p><span className="font-semibold">{fileName}</span>: {contacts.length} rows found.</p>
          <label className="flex items-start gap-2.5">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 accent-teal" />
            <span>Everyone in this file asked us to contact them or is our client.</span>
          </label>
          <button type="button" className="btn-primary" onClick={upload} disabled={!consent || pending}>{pending ? 'Uploading…' : `Add ${contacts.length} contacts`}</button>
        </div>
      )}
      {message && <p className={message.error ? 'text-red-700' : 'text-teal-dark'} role="status">{message.text}</p>}
    </div>
  );
}
