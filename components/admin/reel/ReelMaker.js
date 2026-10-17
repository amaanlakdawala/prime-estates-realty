'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  REEL, SPEEDS, TAGS, MAX_REEL_PHOTOS,
  buildPlan, defaultTag, drawReelFrame, hiResUrl, loadImage, makeBackdrop, reelCaption,
} from '@/lib/reel';

const PREVIEW_SCALE = 0.5; // the preview canvas is drawn at half size; the video at full 1080x1920
const FONTS = ['700 88px "Plus Jakarta Sans"', '500 38px Inter', '600 46px Inter', '700 30px Inter', '700 32px Inter'];
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);

export default function ReelMaker({ listing, site, listingPath }) {
  const photos = listing.photos ?? [];
  const [selected, setSelected] = useState(photos.slice(0, 8));
  const [tag, setTag] = useState(defaultTag(listing));
  const [headline, setHeadline] = useState(listing.title);
  const [showPrice, setShowPrice] = useState(true);
  const [style, setStyle] = useState('full');
  const [speed, setSpeed] = useState('normal');

  const [images, setImages] = useState({}); // url -> { img, backdrop } | 'error'
  const [logo, setLogo] = useState(null);
  const [fontsReady, setFontsReady] = useState(false);
  const [origin, setOrigin] = useState('');
  const [supported, setSupported] = useState(null);
  const [playing, setPlaying] = useState(true);
  const [job, setJob] = useState({ state: 'idle' }); // idle | rendering | done | error
  const [caption, setCaption] = useState('');
  const [copied, setCopied] = useState(false);

  const canvasRef = useRef(null);
  const timeRef = useRef(0);
  const cancelRef = useRef(false);

  // Photos, logo, fonts and browser support, once.
  useEffect(() => {
    setOrigin(window.location.origin);
    photos.forEach((url) => {
      loadImage(hiResUrl(url))
        .catch(() => loadImage(url))
        .then((img) => setImages((m) => ({ ...m, [url]: { img, backdrop: makeBackdrop(img) } })))
        .catch(() => setImages((m) => ({ ...m, [url]: 'error' })));
    });
    if (site.logoUrl) loadImage(site.logoUrl).then(setLogo).catch(() => setLogo(null));
    Promise.all(FONTS.map((f) => document.fonts.load(f))).catch(() => {}).finally(() => setFontsReady(true));
    import('mediabunny')
      .then(({ canEncodeVideo }) => canEncodeVideo('avc', { width: REEL.width, height: REEL.height, frameRate: REEL.fps }))
      .then(setSupported)
      .catch(() => setSupported(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const usable = selected.filter((url) => images[url] && images[url] !== 'error');
  const loading = selected.some((url) => !images[url]);
  const failed = photos.filter((url) => images[url] === 'error').length;

  const plan = useMemo(() => {
    if (!usable.length || loading) return null;
    return buildPlan({
      listing, site, logo, tag, headline, showPrice, style, speed,
      photos: usable.map((url) => images[url]),
      siteUrl: origin && site.websiteEnabled ? `${origin}/${site.slug}` : '', // no website address on the reel when the firm has no website
    });
  }, [usable.join('|'), loading, logo, tag, headline, showPrice, style, speed, origin, fontsReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // Any change makes the last video out of date.
  useEffect(() => {
    if (!plan) return;
    const linkable = origin && site.websiteEnabled && listing.show_on_website !== false;
    setCaption(reelCaption({ listing, site, plan, listingUrl: linkable ? `${origin}${listingPath}` : '' }));
    setJob((j) => {
      if (j.state === 'done') URL.revokeObjectURL(j.url);
      return j.state === 'rendering' ? j : { state: 'idle' };
    });
  }, [plan]); // eslint-disable-line react-hooks/exhaustive-deps

  // Live preview.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !plan) return;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(PREVIEW_SCALE, 0, 0, PREVIEW_SCALE, 0, 0);
    let frame, last = performance.now();
    const tick = (now) => {
      if (playing) timeRef.current = (timeRef.current + (now - last) / 1000) % plan.duration;
      last = now;
      drawReelFrame(ctx, timeRef.current, plan);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [plan, playing]);

  function togglePhoto(url) {
    setSelected((list) => {
      if (list.includes(url)) return list.filter((u) => u !== url);
      return list.length >= MAX_REEL_PHOTOS ? list : [...list, url];
    });
  }

  async function createVideo() {
    if (!plan) return;
    cancelRef.current = false;
    setPlaying(false);
    setJob({ state: 'rendering', progress: 0 });
    try {
      const { Output, Mp4OutputFormat, BufferTarget, CanvasSource, QUALITY_HIGH } = await import('mediabunny');
      const canvas = document.createElement('canvas');
      canvas.width = REEL.width;
      canvas.height = REEL.height;
      const ctx = canvas.getContext('2d');
      const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() });
      const source = new CanvasSource(canvas, { codec: 'avc', quality: QUALITY_HIGH });
      output.addVideoTrack(source, { frameRate: REEL.fps });
      await output.start();
      const frames = Math.ceil(plan.duration * REEL.fps);
      for (let i = 0; i < frames; i++) {
        if (cancelRef.current) { await output.cancel(); setJob({ state: 'idle' }); return; }
        drawReelFrame(ctx, i / REEL.fps, plan);
        await source.add(i / REEL.fps, 1 / REEL.fps);
        if (i % 10 === 0) {
          setJob({ state: 'rendering', progress: i / frames });
          await new Promise((r) => setTimeout(r, 0)); // let the page repaint
        }
      }
      await output.finalize();
      const name = `${slugify(site.slug)}-${slugify(listing.title) || 'listing'}-reel.mp4`;
      const file = new File([output.target.buffer], name, { type: 'video/mp4' });
      setJob({ state: 'done', url: URL.createObjectURL(file), file, size: file.size });
    } catch (err) {
      setJob({ state: 'error', message: err?.message || 'The video could not be created.' });
    }
  }

  async function share() {
    try {
      await navigator.share({ files: [job.file], title: listing.title, text: caption });
    } catch { /* closed the share sheet */ }
  }

  async function copyCaption() {
    try {
      await navigator.clipboard.writeText(caption);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked; the text can still be selected by hand */ }
  }

  if (!photos.length) {
    return (
      <div className="mt-6 rounded-xl border border-dashed border-line bg-white p-10 text-center">
        <p className="font-semibold">This listing has no photos yet</p>
        <p className="mt-1 text-muted">Add photos to the listing first. A reel needs at least one.</p>
      </div>
    );
  }

  const rendering = job.state === 'rendering';
  const canShare = job.state === 'done' && typeof navigator !== 'undefined' && navigator.canShare?.({ files: [job.file] });

  return (
    <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,340px)_1fr]">
      {/* Preview */}
      <div className="lg:sticky lg:top-6 lg:self-start">
        <div className="relative mx-auto w-full max-w-[320px] overflow-hidden rounded-[28px] border-[6px] border-ink bg-ink shadow-lg">
          <canvas
            ref={canvasRef}
            width={REEL.width * PREVIEW_SCALE}
            height={REEL.height * PREVIEW_SCALE}
            className="block aspect-[9/16] h-auto w-full"
            aria-label="Reel preview"
          />
          {!plan && <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-white/80">{loading ? 'Loading photos…' : 'Choose at least one photo'}</p>}
        </div>
        <div className="mt-3 flex items-center justify-center gap-3 text-sm">
          <button type="button" className="btn-outline py-1.5" onClick={() => setPlaying((p) => !p)} disabled={!plan || rendering}>
            {playing ? 'Pause' : 'Play'}
          </button>
          {plan && <span className="text-muted">{Math.round(plan.duration)} seconds · no sound</span>}
        </div>
      </div>

      {/* Options */}
      <div className="space-y-6">
        <section className="rounded-xl border border-line bg-white p-5 sm:p-6">
          <h2 className="text-lg font-semibold">Photos</h2>
          <p className="mt-1 text-sm text-muted">Tap photos to add or remove them. They play in the order you pick them (up to {MAX_REEL_PHOTOS}). The first one carries the headline.</p>
          <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-6">
            {photos.map((url) => {
              const order = selected.indexOf(url);
              const bad = images[url] === 'error';
              return (
                <li key={url}>
                  <button
                    type="button"
                    onClick={() => togglePhoto(url)}
                    disabled={bad || rendering}
                    aria-pressed={order >= 0}
                    aria-label={bad ? 'Photo could not be loaded' : order >= 0 ? `Photo ${order + 1} in the reel, tap to remove` : 'Add photo to the reel'}
                    className={`relative block aspect-square w-full overflow-hidden rounded-lg border-2 ${order >= 0 ? 'border-brand' : 'border-transparent opacity-60 hover:opacity-100'} disabled:cursor-not-allowed`}
                  >
                    <img src={url} alt="" className="h-full w-full object-cover" />
                    {order >= 0 && <span className="absolute left-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">{order + 1}</span>}
                    {bad && <span className="absolute inset-0 flex items-center justify-center bg-white/80 text-xs font-semibold text-red-700">Can&apos;t use</span>}
                  </button>
                </li>
              );
            })}
          </ul>
          {failed > 0 && <p className="mt-3 text-sm text-red-700">{failed} photo{failed > 1 ? 's' : ''} couldn&apos;t be loaded for the video (the website hosting it doesn&apos;t allow it). Upload the photo to the listing instead of linking it.</p>}
        </section>

        <section className="grid gap-4 rounded-xl border border-line bg-white p-5 sm:grid-cols-2 sm:p-6">
          <label className="block sm:col-span-2">
            <span className="field-label">Headline</span>
            <input className="field" value={headline} maxLength={90} onChange={(e) => setHeadline(e.target.value)} disabled={rendering} />
          </label>
          <label className="block">
            <span className="field-label">Label in the corner</span>
            <select className="field" value={tag} onChange={(e) => setTag(e.target.value)} disabled={rendering}>
              {TAGS.map((t) => <option key={t} value={t}>{t}</option>)}
              <option value="">No label</option>
            </select>
          </label>
          <fieldset>
            <legend className="field-label">Speed</legend>
            <div className="flex gap-2">
              {Object.keys(SPEEDS).map((s) => (
                <label key={s} className={`flex-1 cursor-pointer rounded-lg border px-3 py-2 text-center text-sm font-medium capitalize ${speed === s ? 'border-brand bg-brand-light text-brand-dark' : 'border-line'}`}>
                  <input type="radio" name="speed" value={s} checked={speed === s} onChange={() => setSpeed(s)} className="sr-only" disabled={rendering} />
                  {s}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="sm:col-span-2">
            <legend className="field-label">Photo style</legend>
            <div className="flex gap-2">
              {[['full', 'Full screen', 'Photos fill the screen and pan slowly'], ['framed', 'Framed', 'Whole photo on a soft background']].map(([value, label, hint]) => (
                <label key={value} className={`flex-1 cursor-pointer rounded-lg border px-3 py-2 text-sm ${style === value ? 'border-brand bg-brand-light text-brand-dark' : 'border-line'}`}>
                  <input type="radio" name="style" value={value} checked={style === value} onChange={() => setStyle(value)} className="sr-only" disabled={rendering} />
                  <span className="block font-medium">{label}</span>
                  <span className="block text-xs text-muted">{hint}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" checked={showPrice} onChange={(e) => setShowPrice(e.target.checked)} disabled={rendering} />
            Show the price
          </label>
        </section>

        <section className="rounded-xl border border-line bg-white p-5 sm:p-6">
          <h2 className="text-lg font-semibold">Create the video</h2>
          {supported === false ? (
            <p className="mt-2 text-sm text-red-700">This browser can&apos;t create videos. Please open this page in Google Chrome or Microsoft Edge (computer or Android), or Safari on iPhone.</p>
          ) : (
            <>
              <p className="mt-1 text-sm text-muted">The video is made on this device in a few seconds and isn&apos;t uploaded anywhere. Add music in Instagram when you post it, so you can use a trending song.</p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                {rendering ? (
                  <>
                    <div className="h-3 w-56 overflow-hidden rounded-full bg-mist" role="progressbar" aria-valuenow={Math.round(job.progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Creating video">
                      <div className="h-full bg-brand transition-all" style={{ width: `${Math.round(job.progress * 100)}%` }} />
                    </div>
                    <span className="text-sm text-muted">{Math.round(job.progress * 100)}%</span>
                    <button type="button" className="btn-outline py-2" onClick={() => { cancelRef.current = true; }}>Cancel</button>
                  </>
                ) : (
                  <button type="button" className="btn-primary" onClick={createVideo} disabled={!plan || supported === null}>
                    {job.state === 'done' ? 'Create again' : 'Create video'}
                  </button>
                )}
                {job.state === 'done' && (
                  <>
                    <a href={job.url} download={job.file.name} className="btn-primary">Download video ({(job.size / 1048576).toFixed(1)} MB)</a>
                    {canShare && <button type="button" className="btn-outline" onClick={share}>Share to Instagram / WhatsApp</button>}
                  </>
                )}
              </div>
              {job.state === 'error' && <p className="mt-3 text-sm text-red-700" role="alert">{job.message}</p>}
              {job.state === 'done' && <p className="mt-3 text-sm text-brand-dark" role="status">Your reel is ready. On a phone, use Share to send it straight to Instagram.</p>}
            </>
          )}
        </section>

        <section className="rounded-xl border border-line bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Caption</h2>
            <button type="button" className="btn-outline py-1.5 text-sm" onClick={copyCaption} disabled={!caption}>{copied ? 'Copied' : 'Copy caption'}</button>
          </div>
          <p className="mt-1 text-sm text-muted">Ready to paste into Instagram. You can edit it here first.</p>
          <textarea className="field mt-3 min-h-[260px] font-[inherit]" value={caption} onChange={(e) => setCaption(e.target.value)} aria-label="Caption" />
        </section>
      </div>
    </div>
  );
}
