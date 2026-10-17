'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import ConfirmDialog from './ConfirmDialog';
import PropertyImage from '@/components/PropertyImage';
import { createClient } from '@/lib/supabase/client';
import { removeImages } from '@/lib/storage';
import { formatPrice, formatDate, typeLabel } from '@/lib/format';
import { PROPERTY_TYPES } from '@/lib/site';

const STATUS_STYLES = {
  available: 'bg-brand-light text-brand-dark',
  sold: 'bg-ink text-white',
  rented: 'bg-accent/30 text-ink',
};
const STATUS_LABELS = { available: 'Available', sold: 'Sold', rented: 'Rented' };

export default function ListingsTable({ listings }) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [deal, setDeal] = useState('');
  const [type, setType] = useState('');
  const [toDelete, setToDelete] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return listings.filter((l) =>
      (!q || l.title.toLowerCase().includes(q) || l.locality.toLowerCase().includes(q) || (l.address ?? '').toLowerCase().includes(q)) &&
      (!status || l.status === status) &&
      (!deal || l.deal_type === deal) &&
      (!type || l.property_type === type)
    );
  }, [listings, search, status, deal, type]);

  async function setListingStatus(listing, newStatus) {
    setBusyId(listing.id);
    setNotice('');
    const { error } = await createClient().from('listings').update({ status: newStatus }).eq('id', listing.id);
    setBusyId(null);
    if (error) return setNotice(`Status could not be changed: ${error.message}`);
    setNotice(newStatus === 'available' ? `"${listing.title}" is live on the website again.` : `"${listing.title}" marked as ${STATUS_LABELS[newStatus].toLowerCase()} and hidden from the website.`);
    router.refresh();
  }

  async function confirmDelete() {
    const listing = toDelete;
    setDeleting(true);
    const supabase = createClient();
    const { error } = await supabase.from('listings').delete().eq('id', listing.id);
    if (!error) await removeImages(supabase, [...(listing.photos ?? []), listing.floor_plan].filter(Boolean));
    setDeleting(false);
    setToDelete(null);
    if (error) return setNotice(`The listing could not be deleted: ${error.message}`);
    setNotice(`"${listing.title}" deleted.`);
    router.refresh();
  }

  const counts = {
    all: listings.length,
    available: listings.filter((l) => l.status === 'available').length,
  };

  return (
    <div className="mt-6">
      <div className="grid gap-3 rounded-xl border border-line bg-white p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
        <label className="block">
          <span className="field-label">Search</span>
          <input className="field" type="search" placeholder="Title, locality or address" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <label className="block">
          <span className="field-label">Status</span>
          <select className="field" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="available">Available</option>
            <option value="sold">Sold</option>
            <option value="rented">Rented</option>
          </select>
        </label>
        <label className="block">
          <span className="field-label">Sale or rent</span>
          <select className="field" value={deal} onChange={(e) => setDeal(e.target.value)}>
            <option value="">Both</option>
            <option value="buy">For sale</option>
            <option value="rent">For rent</option>
          </select>
        </label>
        <label className="block">
          <span className="field-label">Type</span>
          <select className="field" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">All types</option>
            {PROPERTY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>
      </div>

      <p className="mt-4 text-sm text-muted">
        Showing {filtered.length} of {counts.all} listings. {counts.available} live on the website.
      </p>
      {notice && <p className="mt-3 rounded-lg border border-brand/30 bg-brand-light px-4 py-3 text-sm font-medium text-brand-dark" role="status">{notice}</p>}

      {listings.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-line bg-white p-12 text-center">
          <p className="font-semibold">No listings yet</p>
          <p className="mt-1 text-muted">Add your first property and it will appear on the website straight away.</p>
          <Link href="/admin/new" className="btn-primary mt-5">Add listing</Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-line bg-white p-10 text-center text-muted">No listings match these filters.</div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-white">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b border-line bg-mist text-muted">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Property</th>
                <th scope="col" className="px-4 py-3 font-medium">Location</th>
                <th scope="col" className="px-4 py-3 font-medium">Price</th>
                <th scope="col" className="px-4 py-3 font-medium">Status</th>
                <th scope="col" className="px-4 py-3 font-medium">Added</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.map((l) => {
                const closedStatus = l.deal_type === 'rent' ? 'rented' : 'sold';
                const busy = busyId === l.id;
                return (
                  <tr key={l.id} className="align-middle">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-14 w-20 flex-none overflow-hidden rounded-md"><PropertyImage src={l.photos?.[0]} alt="" /></div>
                        <div className="min-w-0">
                          <Link href={`/admin/${l.id}/edit`} className="font-semibold hover:underline">{l.title}</Link>
                          <p className="text-muted">
                            {typeLabel(l.property_type)}{l.bhk ? `, ${l.bhk} BHK` : ''}
                            {l.featured && <span className="ml-2 rounded bg-accent/30 px-1.5 py-0.5 text-xs font-semibold text-ink">Featured</span>}
                            {l.show_on_website === false && <span className="ml-2 rounded bg-ink/10 px-1.5 py-0.5 text-xs font-semibold text-ink" title="Not on the website. Your team and AI assistant can see it.">Private</span>}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">{l.locality}</td>
                    <td className="px-4 py-3 font-medium">{formatPrice(l.price, l.deal_type)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[l.status]}`}>{STATUS_LABELS[l.status]}</span>
                    </td>
                    <td className="px-4 py-3 text-muted">{formatDate(l.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {l.status === 'available' ? (
                          <button type="button" disabled={busy} onClick={() => setListingStatus(l, closedStatus)} className="rounded-md border border-line px-3 py-1.5 font-medium hover:border-ink disabled:opacity-50">
                            Mark {closedStatus}
                          </button>
                        ) : (
                          <button type="button" disabled={busy} onClick={() => setListingStatus(l, 'available')} className="rounded-md border border-line px-3 py-1.5 font-medium hover:border-ink disabled:opacity-50">
                            Relist
                          </button>
                        )}
                        <Link href={`/admin/${l.id}/edit`} className="rounded-md border border-line px-3 py-1.5 font-medium hover:border-ink">Edit</Link>
                        <Link href={`/admin/${l.id}/reel`} className="rounded-md border border-line px-3 py-1.5 font-medium hover:border-ink">Make reel</Link>
                        {l.status === 'available' && <Link href={`/admin/writeup?listing=${l.id}`} className="rounded-md border border-line px-3 py-1.5 font-medium hover:border-ink">Write-up</Link>}
                        <button type="button" onClick={() => setToDelete(l)} className="rounded-md border border-red-200 px-3 py-1.5 font-medium text-red-700 hover:border-red-700">Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={!!toDelete}
        busy={deleting}
        title="Delete this listing?"
        message={toDelete ? `"${toDelete.title}" and all its photos will be removed permanently. To only hide it from the website, use "Mark ${toDelete.deal_type === 'rent' ? 'rented' : 'sold'}" instead.` : ''}
        confirmLabel="Delete listing"
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
