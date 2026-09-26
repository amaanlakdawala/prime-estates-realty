'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { removeImages } from '@/lib/storage';
import { formatPrice } from '@/lib/format';
import { site, PROPERTY_TYPES, AMENITIES, STORAGE_BUCKET } from '@/lib/site';

const MAX_FILE_MB = 5;
const MAX_PHOTOS = 20;
const ACCEPTED = 'image/jpeg,image/png,image/webp';

function toFormState(l) {
  return {
    title: l?.title ?? '',
    property_type: l?.property_type ?? 'flat',
    deal_type: l?.deal_type ?? 'buy',
    price: l?.price?.toString() ?? '',
    area_sqft: l?.area_sqft?.toString() ?? '',
    bhk: l?.bhk?.toString() ?? '',
    floor: l?.floor ?? '',
    locality: l?.locality ?? '',
    address: l?.address ?? '',
    coords: l?.latitude != null && l?.longitude != null ? `${l.latitude}, ${l.longitude}` : '',
    description: l?.description ?? '',
    amenities: l?.amenities ?? [],
    rera_number: l?.rera_number ?? '',
    status: l?.status ?? 'available',
    featured: l?.featured ?? false,
  };
}

function parseCoords(text) {
  if (!text.trim()) return { latitude: null, longitude: null };
  const m = text.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  if (!m) return null;
  const latitude = Number(m[1]);
  const longitude = Number(m[2]);
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}

async function uploadFile(supabase, folder, file) {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, { cacheControl: '31536000', contentType: file.type });
  if (error) throw new Error(`Photo "${file.name}" could not be uploaded: ${error.message}`);
  return supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}

export default function ListingForm({ initial = null }) {
  const router = useRouter();
  const isEdit = !!initial;
  const [form, setForm] = useState(() => toFormState(initial));
  // Each photo is either { url } (already uploaded) or { file, preview } (new, not uploaded yet)
  const [photos, setPhotos] = useState(() => (initial?.photos ?? []).map((url) => ({ url })));
  const [floorPlan, setFloorPlan] = useState(() => (initial?.floor_plan ? { url: initial.floor_plan } : null));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState('');
  const removedUrls = useRef([]);
  const photoInput = useRef(null);

  // Free preview memory when the page is left
  useEffect(() => () => {
    photos.forEach((p) => p.preview && URL.revokeObjectURL(p.preview));
    if (floorPlan?.preview) URL.revokeObjectURL(floorPlan.preview);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((er) => ({ ...er, [key]: undefined }));
  };

  const toggleAmenity = (a) =>
    setForm((f) => ({ ...f, amenities: f.amenities.includes(a) ? f.amenities.filter((x) => x !== a) : [...f.amenities, a] }));

  function checkFile(file) {
    if (!ACCEPTED.split(',').includes(file.type)) return `"${file.name}" is not a JPG, PNG or WebP image.`;
    if (file.size > MAX_FILE_MB * 1024 * 1024) return `"${file.name}" is larger than ${MAX_FILE_MB} MB. Compress it and try again.`;
    return null;
  }

  function addPhotos(e) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    const problems = [];
    const accepted = [];
    for (const file of files) {
      const problem = checkFile(file);
      if (problem) problems.push(problem);
      else accepted.push({ file, preview: URL.createObjectURL(file) });
    }
    setPhotos((prev) => {
      const room = MAX_PHOTOS - prev.length;
      if (accepted.length > room) problems.push(`Only ${MAX_PHOTOS} photos are allowed per listing.`);
      return [...prev, ...accepted.slice(0, Math.max(room, 0))];
    });
    setErrors((er) => ({ ...er, photos: problems.join(' ') || undefined }));
  }

  function removePhoto(index) {
    setPhotos((prev) => {
      const p = prev[index];
      if (p.url) removedUrls.current.push(p.url);
      if (p.preview) URL.revokeObjectURL(p.preview);
      return prev.filter((_, i) => i !== index);
    });
  }

  function makeCover(index) {
    setPhotos((prev) => [prev[index], ...prev.filter((_, i) => i !== index)]);
  }

  function setFloorPlanFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const problem = checkFile(file);
    if (problem) return setErrors((er) => ({ ...er, floor_plan: problem }));
    if (floorPlan?.url) removedUrls.current.push(floorPlan.url);
    if (floorPlan?.preview) URL.revokeObjectURL(floorPlan.preview);
    setFloorPlan({ file, preview: URL.createObjectURL(file) });
    setErrors((er) => ({ ...er, floor_plan: undefined }));
  }

  function removeFloorPlan() {
    if (floorPlan?.url) removedUrls.current.push(floorPlan.url);
    if (floorPlan?.preview) URL.revokeObjectURL(floorPlan.preview);
    setFloorPlan(null);
  }

  function validate() {
    // Every field is optional. These only catch values that would be nonsensical if entered.
    const er = {};
    if (form.title.trim() && form.title.trim().length < 5) er.title = 'If you enter a title, make it at least 5 characters, for example "Spacious 2 BHK near Balewadi High Street".';
    if (form.price && Number(form.price) < 0) er.price = 'Price cannot be negative.';
    if (form.area_sqft && Number(form.area_sqft) < 0) er.area_sqft = 'Area cannot be negative.';
    if (form.bhk && (Number(form.bhk) < 0 || Number(form.bhk) > 20)) er.bhk = 'Enter a BHK between 0 and 20.';
    if (form.coords.trim() && parseCoords(form.coords) === null) er.coords = 'Use the format 18.5590, 73.7868 (latitude, longitude).';
    return er;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setFormError('');
    const er = validate();
    setErrors(er);
    if (Object.keys(er).length) {
      setFormError('Fix the highlighted fields and save again.');
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const folder = initial?.id ?? (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `new-${Date.now()}`);

    try {
      // 1. Upload new photos in their current order
      const photoUrls = [];
      const newCount = photos.filter((p) => p.file).length;
      let uploaded = 0;
      for (const p of photos) {
        if (p.url) {
          photoUrls.push(p.url);
        } else {
          uploaded += 1;
          setProgress(`Uploading photo ${uploaded} of ${newCount}…`);
          photoUrls.push(await uploadFile(supabase, folder, p.file));
        }
      }

      // 2. Upload the floor plan if a new one was chosen
      let floorPlanUrl = floorPlan?.url ?? null;
      if (floorPlan?.file) {
        setProgress('Uploading floor plan…');
        floorPlanUrl = await uploadFile(supabase, folder, floorPlan.file);
      }

      // 3. Save the listing
      setProgress('Saving listing…');
      const { latitude, longitude } = parseCoords(form.coords) ?? { latitude: null, longitude: null };
      const record = {
        title: form.title.trim() || 'Untitled listing',
        property_type: form.property_type,
        deal_type: form.deal_type,
        price: form.price ? Math.round(Number(form.price)) : 0,
        area_sqft: form.area_sqft ? Math.round(Number(form.area_sqft)) : null,
        bhk: form.bhk !== '' ? Number(form.bhk) : null,
        floor: form.floor.trim() || null,
        locality: form.locality.trim() || 'Not specified',
        address: form.address.trim() || null,
        latitude,
        longitude,
        description: form.description.trim() || null,
        amenities: form.amenities,
        rera_number: form.rera_number.trim() || null,
        photos: photoUrls,
        floor_plan: floorPlanUrl,
        status: form.status,
        featured: form.featured,
      };

      const { error } = isEdit
        ? await supabase.from('listings').update(record).eq('id', initial.id)
        : await supabase.from('listings').insert(record);
      if (error) throw new Error(`The listing could not be saved: ${error.message}`);

      // 4. Clean up photos that were removed during editing
      if (removedUrls.current.length) await removeImages(supabase, removedUrls.current);

      router.push('/admin');
      router.refresh();
    } catch (err) {
      setFormError(err.message || 'Something went wrong while saving. Check your connection and try again.');
      setSaving(false);
      setProgress('');
    }
  }

  const fieldClass = (key) => `field ${errors[key] ? 'border-red-600 focus:border-red-600 focus:ring-red-600/20' : ''}`;
  const Err = ({ k }) => (errors[k] ? <p className="mt-1.5 text-sm text-red-700">{errors[k]}</p> : null);
  const showBhk = ['flat', 'villa'].includes(form.property_type);

  return (
    <form onSubmit={onSubmit} noValidate className="mt-6 space-y-6">
      {/* Basics */}
      <section className="rounded-xl border border-line bg-white p-5 sm:p-6">
        <h2 className="text-xl font-semibold">Basics</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="field-label">Title <span className="font-normal text-muted">(optional)</span></span>
            <input className={fieldClass('title')} value={form.title} onChange={set('title')} placeholder="Spacious 2 BHK near Balewadi High Street" />
            <Err k="title" />
          </label>
          <label className="block">
            <span className="field-label">Property type</span>
            <select className="field" value={form.property_type} onChange={set('property_type')}>
              {PROPERTY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </label>
          <fieldset>
            <legend className="field-label">Listed for</legend>
            <div className="flex gap-2">
              {[['buy', 'Sale'], ['rent', 'Rent']].map(([v, label]) => (
                <label key={v} className={`flex flex-1 cursor-pointer items-center justify-center rounded-lg border px-4 py-2.5 text-[15px] font-medium ${form.deal_type === v ? 'border-teal bg-teal-light text-teal-dark' : 'border-line'}`}>
                  <input type="radio" name="deal_type" value={v} checked={form.deal_type === v} onChange={set('deal_type')} className="sr-only" />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      </section>

      {/* Price and size */}
      <section className="rounded-xl border border-line bg-white p-5 sm:p-6">
        <h2 className="text-xl font-semibold">Price and size</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className="field-label">{form.deal_type === 'rent' ? 'Monthly rent (₹)' : 'Price (₹)'} <span className="font-normal text-muted">(optional)</span></span>
            <input className={fieldClass('price')} inputMode="numeric" value={form.price} onChange={(e) => { setForm((f) => ({ ...f, price: e.target.value.replace(/\D/g, '') })); setErrors((er) => ({ ...er, price: undefined })); }} placeholder={form.deal_type === 'rent' ? '35000' : '8500000'} />
            {form.price && !errors.price && <p className="mt-1.5 text-sm text-muted">Shows as {formatPrice(Number(form.price), form.deal_type)}</p>}
            <Err k="price" />
          </label>
          <label className="block">
            <span className="field-label">Area (sq ft)</span>
            <input className={fieldClass('area_sqft')} inputMode="numeric" value={form.area_sqft} onChange={(e) => setForm((f) => ({ ...f, area_sqft: e.target.value.replace(/\D/g, '') }))} placeholder="1050" />
            <Err k="area_sqft" />
          </label>
          {showBhk && (
            <label className="block">
              <span className="field-label">BHK</span>
              <select className={fieldClass('bhk')} value={form.bhk} onChange={set('bhk')}>
                <option value="">Not applicable</option>
                {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n} BHK</option>)}
              </select>
              <Err k="bhk" />
            </label>
          )}
          <label className="block">
            <span className="field-label">Floor</span>
            <input className="field" value={form.floor} onChange={set('floor')} placeholder="7th of 14" />
          </label>
        </div>
      </section>

      {/* Location */}
      <section className="rounded-xl border border-line bg-white p-5 sm:p-6">
        <h2 className="text-xl font-semibold">Location</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <label className="block">
            <span className="field-label">Locality <span className="font-normal text-muted">(optional)</span></span>
            <input className={fieldClass('locality')} list="localities" value={form.locality} onChange={set('locality')} placeholder="Baner" />
            <datalist id="localities">{site.localities.map((l) => <option key={l} value={l} />)}</datalist>
            <p className="mt-1.5 text-sm text-muted">Pick from the list so the listing appears in locality searches.</p>
            <Err k="locality" />
          </label>
          <label className="block">
            <span className="field-label">Map coordinates <span className="font-normal text-muted">(optional)</span></span>
            <input className={fieldClass('coords')} value={form.coords} onChange={set('coords')} placeholder="18.5590, 73.7868" />
            <p className="mt-1.5 text-sm text-muted">In Google Maps, right-click the building and select the numbers at the top to copy them.</p>
            <Err k="coords" />
          </label>
          <label className="block sm:col-span-2">
            <span className="field-label">Full address <span className="font-normal text-muted">(optional)</span></span>
            <input className="field" value={form.address} onChange={set('address')} placeholder="Tower B, Green Meadows, Baner–Pashan Link Road, Baner, Pune 411045" />
          </label>
        </div>
      </section>

      {/* Details */}
      <section className="rounded-xl border border-line bg-white p-5 sm:p-6">
        <h2 className="text-xl font-semibold">Description and amenities</h2>
        <div className="mt-5 space-y-5">
          <label className="block">
            <span className="field-label">Description</span>
            <textarea className="field min-h-[160px]" value={form.description} onChange={set('description')} placeholder="East-facing flat with two balconies, 5 minutes from Balewadi High Street…" />
          </label>
          <fieldset>
            <legend className="field-label">Amenities</legend>
            <div className="mt-1 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {AMENITIES.map((a) => (
                <label key={a} className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-line px-3 py-2.5 text-[15px] has-[:checked]:border-teal has-[:checked]:bg-teal-light">
                  <input type="checkbox" checked={form.amenities.includes(a)} onChange={() => toggleAmenity(a)} className="h-4 w-4 accent-teal" />
                  {a}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="block sm:max-w-sm">
            <span className="field-label">RERA project number <span className="font-normal text-muted">(optional)</span></span>
            <input className="field" value={form.rera_number} onChange={set('rera_number')} placeholder="P52100012345" />
          </label>
        </div>
      </section>

      {/* Photos */}
      <section className="rounded-xl border border-line bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Photos</h2>
            <p className="mt-1 text-sm text-muted">JPG, PNG or WebP, up to {MAX_FILE_MB} MB each. The first photo is the cover.</p>
          </div>
          <button type="button" className="btn-outline" onClick={() => photoInput.current?.click()}>Add photos</button>
          <input ref={photoInput} type="file" accept={ACCEPTED} multiple className="sr-only" onChange={addPhotos} tabIndex={-1} aria-hidden="true" />
        </div>
        <Err k="photos" />
        {photos.length ? (
          <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {photos.map((p, i) => (
              <li key={p.url ?? p.preview} className="overflow-hidden rounded-lg border border-line">
                <div className="relative aspect-[4/3] bg-stone">
                  <img src={p.url ?? p.preview} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
                  {i === 0 && <span className="absolute left-2 top-2 rounded bg-basalt px-2 py-0.5 text-xs font-semibold text-white">Cover</span>}
                  {p.file && <span className="absolute right-2 top-2 rounded bg-marigold px-2 py-0.5 text-xs font-semibold text-basalt">New</span>}
                </div>
                <div className="flex text-xs font-medium">
                  {i !== 0 && <button type="button" onClick={() => makeCover(i)} className="flex-1 border-r border-line py-2 hover:bg-stone">Make cover</button>}
                  <button type="button" onClick={() => removePhoto(i)} className="flex-1 py-2 text-red-700 hover:bg-red-50">Remove</button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <button type="button" onClick={() => photoInput.current?.click()} className="mt-5 flex w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-line py-10 text-muted hover:border-teal hover:text-teal">
            <span className="font-semibold">No photos yet</span>
            <span className="text-sm">Select to add photos. Listings with photos get far more enquiries.</span>
          </button>
        )}

        <div className="mt-8 border-t border-line pt-6">
          <h3 className="font-display text-lg font-semibold">Floor plan <span className="font-sans text-sm font-normal text-muted">(optional)</span></h3>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            {floorPlan && (
              <div className="h-24 w-32 overflow-hidden rounded-lg border border-line bg-stone">
                <img src={floorPlan.url ?? floorPlan.preview} alt="Floor plan preview" className="h-full w-full object-contain" />
              </div>
            )}
            <label className="btn-outline cursor-pointer">
              {floorPlan ? 'Replace floor plan' : 'Upload floor plan'}
              <input type="file" accept={ACCEPTED} className="sr-only" onChange={setFloorPlanFile} />
            </label>
            {floorPlan && <button type="button" onClick={removeFloorPlan} className="text-sm font-medium text-red-700 hover:underline">Remove</button>}
          </div>
          <Err k="floor_plan" />
        </div>
      </section>

      {/* Visibility */}
      <section className="rounded-xl border border-line bg-white p-5 sm:p-6">
        <h2 className="text-xl font-semibold">Visibility</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <label className="block">
            <span className="field-label">Status</span>
            <select className="field" value={form.status} onChange={set('status')}>
              <option value="available">Available (shown on website)</option>
              <option value="sold">Sold (hidden from website)</option>
              <option value="rented">Rented (hidden from website)</option>
            </select>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line p-4 has-[:checked]:border-teal has-[:checked]:bg-teal-light">
            <input type="checkbox" checked={form.featured} onChange={set('featured')} className="mt-1 h-4 w-4 accent-teal" />
            <span>
              <span className="block font-medium">Feature on the home page</span>
              <span className="text-sm text-muted">Up to 6 featured listings are shown, newest first.</span>
            </span>
          </label>
        </div>
      </section>

      {/* Actions */}
      <div className="sticky bottom-0 -mx-5 flex flex-wrap items-center justify-end gap-3 border-t border-line bg-stone/95 px-5 py-4 backdrop-blur sm:-mx-8 sm:px-8">
        {formError && <p className="mr-auto text-sm font-medium text-red-700" role="alert">{formError}</p>}
        {saving && progress && <p className="mr-auto text-sm text-muted" role="status">{progress}</p>}
        <button type="button" className="btn-outline" onClick={() => router.push('/admin')} disabled={saving}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add listing'}</button>
      </div>
    </form>
  );
}
